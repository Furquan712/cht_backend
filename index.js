require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Keep a map of userId -> socketId
const users = new Map();
// Keep a map of ownerUserId -> socketId
const owners = new Map();

// Mongo
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'aichatbot';
let chatsCollection = null;
(async function initMongo(){
  try{
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    chatsCollection = db.collection('chats');
    console.log('[mongo] connected to', MONGO_URI, MONGO_DB);
  } catch (e) { console.error('Mongo init error', e); }
})();

// buffer messages per user while connected
const messagesBuffer = new Map();
// temporary metadata store for connected users (can be set by owner/admin)
const metadataBuffer = new Map();

// helper to send an event to a specific owner (by ownerUserId) if connected; do NOT broadcast to all owners
function sendToOwnerOrBroadcast(ownerUserId, event, payload) {
  try {
    if (ownerUserId && owners.has(ownerUserId)) {
      const ownerSocketId = owners.get(ownerUserId);
      io.to(ownerSocketId).emit(event, payload);
    } else {
      // No specific owner connected - do not broadcast to every owner
      console.log('[io] no owner socket connected for', ownerUserId, '; skipping', event);
    }
  } catch (e) {
    console.error('sendToOwnerOrBroadcast error', e);
  }
}

io.on('connection', async (socket) => {
  const query = socket.handshake.query || {};
  const role = query.role || 'user';
  const userId = query.userId || null;
  let ownerUserId = query.ownerId || null; // when owners connect, they may provide their user _id

  // If ownerUserId not provided in query, try to read auth_token cookie and verify JWT
  if (!ownerUserId && socket.handshake && socket.handshake.headers && socket.handshake.headers.cookie) {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const match = cookieHeader.match(/auth_token=([^;]+)/);
      const token = match ? decodeURIComponent(match[1]) : null;
      if (token && process.env.JWT_SECRET) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.userId) {
            ownerUserId = decoded.userId;
            console.log('[io] owner identified from cookie JWT as', ownerUserId);
          }
        } catch(e) {
          // invalid token; ignore
        }
      }
    } catch(e) { console.error('cookie parse error', e); }
  }

  console.log('[io] connect', socket.id, { role, userId, ownerUserId });

  if (role === 'owner') {
    socket.join('owners');
    if (ownerUserId) {
      owners.set(ownerUserId, socket.id);
      console.log('[io] registered owner socket', ownerUserId, socket.id);
    }

    socket.on('disconnect', () => {
      console.log('[io] owner disconnect', socket.id);
      if (ownerUserId && owners.get(ownerUserId) === socket.id) owners.delete(ownerUserId);
    });

    // Owner can send messages to a specific user
    socket.on('message', async (payload) => {
      try {
        const { userId: uid, text } = payload || {};
        if (!uid) return;

        // forward to user socket if connected
        const sid = users.get(uid);
        if (sid) {
          io.to(sid).emit('message', { from: 'owner', text, userId: uid, ts: Date.now(), ownerId: ownerUserId || socket.id });
        }

        // persist in buffer, include ownerUserId when provided
        if (uid) {
          const arr = messagesBuffer.get(uid) || [];
          const msgObj = { from: 'owner', text, ts: Date.now(), ownerId: ownerUserId || socket.id };
          arr.push(msgObj);
          messagesBuffer.set(uid, arr);

          // also persist incrementally to MongoDB
          try{
            if (chatsCollection) {
              await chatsCollection.updateOne(
                { userId: uid },
                {
                  $setOnInsert: { userId: uid, createdAt: new Date() },
                  $set: { ownerId: ownerUserId || socket.id },
                  $push: { conversation: msgObj }
                },
                { upsert: true }
              );
            }
          } catch(e){ console.error('mongo append owner message error', e); }

          // notify the correct owner only (if ownerUserId exists on the chat)
          try {
            // send the message event back to the owner who owns this chat (if known)
            const targetOwnerId = ownerUserId || (await (async () => {
              // try to lookup owner from DB metadata if available
              if (!chatsCollection) return null;
              const doc = await chatsCollection.findOne({ userId: uid });
              return doc?.ownerId || null;
            })());

            sendToOwnerOrBroadcast(targetOwnerId, 'message', { from: 'owner', text, userId: uid, ts: Date.now(), ownerId: targetOwnerId });
          } catch(e){ console.error('notify owner error', e); }
        }
      } catch (e) { console.error(e); }
    });

    // Owner may request to join a user's room (optional)
    socket.on('joinUser', (uid) => {
      const sid = users.get(uid);
      if (sid) socket.join(sid);
    });

  } else {
    // treat as user
    const uid = userId || socket.id;
    users.set(uid, socket.id);
    socket.join(socket.id);

    // initialize buffer for user
    if (!messagesBuffer.has(uid)) messagesBuffer.set(uid, []);

    // determine owner for this user (from metadata buffer or DB)
    let targetOwner = null;
    const meta = metadataBuffer.get(uid) || {};
    if (meta && meta.ownerId) targetOwner = meta.ownerId;
    if (!targetOwner && chatsCollection) {
      try {
        const doc = await chatsCollection.findOne({ userId: uid });
        if (doc && doc.ownerId) targetOwner = doc.ownerId;
      } catch(e){ /* ignore */ }
    }

    // notify owners (prefer targetOwner)
    try {
      if (targetOwner) {
        sendToOwnerOrBroadcast(targetOwner, 'user:connected', { userId: uid });
      } else {
        console.log('[io] user connected but no owner assigned yet for', uid);
      }
    } catch(e){ console.error('notify owners connect error', e); }

    socket.on('disconnect', async () => {
      users.delete(uid);
      // inform assigned owner only (if any)
      try {
        // try to determine owner from metadata buffer or DB
        let notifyOwner = null;
        const metaTmp = metadataBuffer.get(uid) || {};
        if (metaTmp && metaTmp.ownerId) notifyOwner = metaTmp.ownerId;
        if (!notifyOwner && chatsCollection) {
          try {
            const doc = await chatsCollection.findOne({ userId: uid });
            if (doc && doc.ownerId) notifyOwner = doc.ownerId;
          } catch (e) { /* ignore */ }
        }
        if (notifyOwner) {
          sendToOwnerOrBroadcast(notifyOwner, 'user:disconnected', { userId: uid });
        } else {
          console.log('[io] user disconnected but no owner assigned for', uid);
        }
      } catch(e){ console.error('notify owners disconnect error', e); }
      console.log('[io] user disconnect', uid);

      // on disconnect update metadata (do not push buffered messages again — those are persisted per-message)
      try {
        const conv = messagesBuffer.get(uid) || [];
        const meta = metadataBuffer.get(uid) || {};
        let ownerId = meta.ownerId || null;
        if (!ownerId) {
          for (let i = (conv.length - 1); i >= 0; i--) {
            if (conv[i].from === 'owner' && conv[i].ownerId) { ownerId = conv[i].ownerId; break; }
          }
        }

        if (chatsCollection) {
          await chatsCollection.updateOne(
            { userId: uid },
            {
              $setOnInsert: { userId: uid, createdAt: new Date() },
              $set: {
                ownerId: ownerId || null,
                username: meta.username || null,
                useremail: meta.useremail || null,
                userphone: meta.userphone || null,
                lastSeen: new Date()
              }
            },
            { upsert: true }
          );
          console.log('[mongo] updated metadata/lastSeen for', uid);
        }
      } catch (e) { console.error('save conv error', e); }

      messagesBuffer.delete(uid);
      metadataBuffer.delete(uid);
    });

    // user sends message -> forward to owners (prefer the assigned owner)
    socket.on('message', async (payload) => {
      try {
        const text = (payload && payload.text) || '';

        // figure out owner
        const meta = metadataBuffer.get(uid) || {};
        let targetOwnerId = meta.ownerId || null;
        if (!targetOwnerId && chatsCollection) {
          try {
            const doc = await chatsCollection.findOne({ userId: uid });
            if (doc && doc.ownerId) targetOwnerId = doc.ownerId;
          } catch(e) { /* ignore */ }
        }

        // send message to the owner (or broadcast if unknown)
        try { 
          if (targetOwnerId) sendToOwnerOrBroadcast(targetOwnerId, 'message', { from: 'user', text, userId: uid, ts: Date.now() });
          else console.log('[io] incoming message but no owner assigned for', uid);
        } catch(e){ console.error('emit message to owner error', e); }

        // push to buffer
        const arr = messagesBuffer.get(uid) || [];
        const msgObj = { from: 'user', text, ts: Date.now() };
        arr.push(msgObj);
        messagesBuffer.set(uid, arr);

        // also persist incrementally to MongoDB
        try{
          if (chatsCollection) {
            await chatsCollection.updateOne(
              { userId: uid },
              { $setOnInsert: { userId: uid, createdAt: new Date() }, $push: { conversation: msgObj } },
              { upsert: true }
            );
          }
        } catch(e){ console.error('mongo append user message error', e); }

      } catch (e) { console.error(e); }
    });
  }

  // allow owner to set metadata via socket (from dashboard or admin)
  socket.on('setMetadata', async (payload) => {
    try {
      const { userId: uid, username, useremail, userphone, ownerId } = payload || {};
      if (!uid) return;
      const meta = { username: username || null, useremail: useremail || null, userphone: userphone || null, ownerId: ownerId || null };
      metadataBuffer.set(uid, meta);
      if (chatsCollection) {
        await chatsCollection.updateOne(
          { userId: uid },
          { $setOnInsert: { userId: uid, createdAt: new Date() }, $set: meta },
          { upsert: true }
        );
      }
      // notify the specific owner only
      try {
        if (ownerId) sendToOwnerOrBroadcast(ownerId, 'metadata:updated', Object.assign({ userId: uid }, meta));
      } catch(e){ console.error('emit metadata update error', e); }
    } catch (e) { console.error('socket setMetadata error', e); }
  });

}); // end io.on('connection')

// HTTP endpoints to retrieve stored chats
app.get('/chats', async (req, res) => {
  try {
    if (!chatsCollection) return res.status(500).json({ error: 'db not connected' });
    const docs = await chatsCollection.find({}).sort({ createdAt: -1 }).limit(200).toArray();
    res.json(docs);
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
});

app.get('/chats/:userId', async (req, res) => {
  try {
    if (!chatsCollection) return res.status(500).json({ error: 'db not connected' });
    const uid = req.params.userId;
    const doc = await chatsCollection.findOne({ userId: uid }, { sort: { createdAt: -1 } });
    res.json(doc || {});
  } catch (e) { console.error(e); res.status(500).json({ error: 'failed' }); }
});

// allow owner/admin to set metadata for a user via HTTP as well
app.post('/chats/:userId/metadata', async (req, res) => {
  try {
    const uid = req.params.userId;
    const { username, useremail, userphone, ownerId } = req.body || {};
    const meta = { username: username || null, useremail: useremail || null, userphone: userphone || null, ownerId: ownerId || null };
    metadataBuffer.set(uid, meta);
    if (chatsCollection) {
      await chatsCollection.updateOne(
        { userId: uid },
        { $setOnInsert: { userId: uid, createdAt: new Date() }, $set: meta },
        { upsert: true }
      );
    }
    // notify owners
    try { io.to('owners').emit('metadata:updated', Object.assign({ userId: uid }, meta)); } catch(e){ console.error('emit metadata update error', e); }
    res.json({ ok: true });
  } catch (e) { console.error('metadata save error', e); res.status(500).json({ error: 'failed' }); }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Socket server listening on http://localhost:${PORT}`));
