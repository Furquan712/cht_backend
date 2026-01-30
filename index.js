require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const { processUserMessage, handleAdminMessage, resetAiForUser, getAiStateInfo } = require('./functions/aiChatHandler');

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
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
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

    // Handler for owner:ready - when owner connects/requests active users
    socket.on('owner:ready', async (payload) => {
      try {
        const reqOwnerId = payload?.ownerId || ownerUserId;
        console.log('[io] owner:ready for', reqOwnerId);
        
        // Send list of active users for this owner
        if (reqOwnerId) {
          const activeUsers = [];
          
          // Get all connected users
          for (const [userId, socketId] of users.entries()) {
            // Check if this user belongs to this owner
            try {
              if (chatsCollection) {
                const doc = await chatsCollection.findOne({ userId });
                if (doc && doc.ownerId === reqOwnerId) {
                  activeUsers.push(userId);
                }
              }
            } catch(e) { /* ignore */ }
          }
          
          socket.emit('active-users', { users: activeUsers });
          console.log('[io] sent active-users to owner', reqOwnerId, ':', activeUsers);
        }
      } catch(e) {
        console.error('[io] owner:ready error', e);
      }
    });

    // Handler for get:active-users - same as owner:ready
    socket.on('get:active-users', async () => {
      try {
        console.log('[io] get:active-users for owner', ownerUserId);
        
        if (ownerUserId) {
          const activeUsers = [];
          
          for (const [userId, socketId] of users.entries()) {
            try {
              if (chatsCollection) {
                const doc = await chatsCollection.findOne({ userId });
                if (doc && doc.ownerId === ownerUserId) {
                  activeUsers.push(userId);
                }
              }
            } catch(e) { /* ignore */ }
          }
          
          socket.emit('active-users', { users: activeUsers });
          console.log('[io] sent active-users:', activeUsers);
        }
      } catch(e) {
        console.error('[io] get:active-users error', e);
      }
    });

    // Owner can send messages to a specific user
    socket.on('message', async (payload) => {
      try {
        const { userId: uid, text } = payload || {};
        if (!uid) return;

        // ============ DEACTIVATE AI WHEN ADMIN RESPONDS ============
        // When admin sends a message, AI stops responding
        try {
          await handleAdminMessage(uid);
        } catch (aiError) {
          console.error('[AI] Error deactivating AI:', aiError);
        }
        // ============ END AI DEACTIVATION ============

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

    // determine owner for this user (from query, metadata buffer, or DB)
    let targetOwner = ownerUserId || null; // Use ownerId from connection query if provided
    
    if (!targetOwner) {
      const meta = metadataBuffer.get(uid) || {};
      if (meta && meta.ownerId) targetOwner = meta.ownerId;
    }
    
    if (!targetOwner && chatsCollection) {
      try {
        const doc = await chatsCollection.findOne({ userId: uid });
        if (doc && doc.ownerId) targetOwner = doc.ownerId;
      } catch(e){ /* ignore */ }
    }
    
    // If we have an ownerId, save it to the chat document
    if (targetOwner && chatsCollection) {
      try {
        await chatsCollection.updateOne(
          { userId: uid },
          {
            $setOnInsert: { userId: uid, createdAt: new Date(), conversation: [] },
            $set: { ownerId: targetOwner }
          },
          { upsert: true }
        );
        console.log('[io] assigned user', uid, 'to owner', targetOwner);
      } catch(e) { console.error('save ownerId error', e); }
    }

    // notify owners (prefer targetOwner)
    try {
      if (targetOwner) {
        sendToOwnerOrBroadcast(targetOwner, 'user:connected', { userId: uid });
        console.log('[io] notified owner', targetOwner, 'about user connection:', uid);
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

        // figure out owner - check connection query first
        let targetOwnerId = ownerUserId || null;
        
        if (!targetOwnerId) {
          const meta = metadataBuffer.get(uid) || {};
          targetOwnerId = meta.ownerId || null;
        }
        
        if (!targetOwnerId && chatsCollection) {
          try {
            const doc = await chatsCollection.findOne({ userId: uid });
            if (doc && doc.ownerId) targetOwnerId = doc.ownerId;
          } catch(e) { /* ignore */ }
        }

        // send message to the owner (or broadcast if unknown)
        try { 
          if (targetOwnerId) {
            // Get metadata from buffer or database
            let meta = metadataBuffer.get(uid) || {};
            
            // If metadata not in buffer, try to load from database
            if ((!meta.username && !meta.useremail && !meta.userphone) && chatsCollection) {
              try {
                const doc = await chatsCollection.findOne({ userId: uid });
                if (doc) {
                  meta = {
                    username: doc.username || null,
                    useremail: doc.useremail || null,
                    userphone: doc.userphone || null,
                    ownerId: doc.ownerId || null
                  };
                  // Update buffer for future messages
                  metadataBuffer.set(uid, meta);
                  console.log('[io] loaded metadata from DB for', uid);
                }
              } catch (dbError) {
                console.error('[io] error loading metadata from DB:', dbError);
              }
            }
            
            const messagePayload = { 
              from: 'user', 
              text, 
              userId: uid, 
              ts: Date.now(),
              username: meta.username || null,
              useremail: meta.useremail || null,
              userphone: meta.userphone || null
            };
            sendToOwnerOrBroadcast(targetOwnerId, 'message', messagePayload);
            console.log('[io] forwarded user message to owner', targetOwnerId, 'with metadata:', { username: meta.username, useremail: meta.useremail, userphone: meta.userphone });
          } else {
            console.log('[io] incoming message but no owner assigned for', uid);
          }
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
              { 
                $setOnInsert: { userId: uid, createdAt: new Date() },
                $set: { ownerId: targetOwnerId || null },
                $push: { conversation: msgObj }
              },
              { upsert: true }
            );
          }
        } catch(e){ console.error('mongo append user message error', e); }

        // ============ AI RESPONSE INTEGRATION ============
        // Process message with AI if admin hasn't taken over
        try {
          console.log(`[AI] Processing message for user ${uid}, ownerId: ${targetOwnerId || 'none'}`);
          const aiResponse = await processUserMessage(uid, text, targetOwnerId);
          
          if (aiResponse) {
            console.log(`[AI] Generated response for user ${uid}`);
            // Send AI response to user
            const sid = users.get(uid);
            if (sid) {
              io.to(sid).emit('message', aiResponse);
              console.log(`[AI] Sent response to user ${uid} via socket ${sid}`);
            }
            
            // Notify owner about AI response
            if (targetOwnerId) {
              sendToOwnerOrBroadcast(targetOwnerId, 'message', aiResponse);
              console.log(`[AI] Notified owner ${targetOwnerId} about AI response`);
            }
            
            // Add to message buffer
            const aiArr = messagesBuffer.get(uid) || [];
            aiArr.push(aiResponse);
            messagesBuffer.set(uid, aiArr);
            
            // Persist AI message to MongoDB
            try {
              if (chatsCollection) {
                await chatsCollection.updateOne(
                  { userId: uid },
                  { 
                    $setOnInsert: { userId: uid, createdAt: new Date() },
                    $set: { ownerId: targetOwnerId || null },
                    $push: { conversation: aiResponse }
                  },
                  { upsert: true }
                );
              }
            } catch(e) { console.error('mongo append AI message error', e); }
          } else {
            console.log(`[AI] No response generated for user ${uid} (AI might be inactive)`);
          }
        } catch (aiError) {
          console.error('[AI] Error processing user message:', aiError);
        }
        // ============ END AI INTEGRATION ============

      } catch (e) { console.error(e); }
    });
  }

  // allow owner to set metadata via socket (from dashboard or admin)
  socket.on('setMetadata', async (payload) => {
    try {
      console.log('[setMetadata] 📝 Received payload:', JSON.stringify(payload, null, 2));
      const { userId: uid, username, useremail, userphone, ownerId } = payload || {};
      if (!uid) {
        console.log('[setMetadata] ❌ No userId in payload, ignoring');
        return;
      }
      const meta = { username: username || null, useremail: useremail || null, userphone: userphone || null, ownerId: ownerId || null };
      console.log('[setMetadata] 💾 Storing in buffer for userId:', uid, 'meta:', meta);
      metadataBuffer.set(uid, meta);
      if (chatsCollection) {
        console.log('[setMetadata] 🗄️  Upserting to MongoDB...');
        const result = await chatsCollection.updateOne(
          { userId: uid },
          { $setOnInsert: { userId: uid, createdAt: new Date() }, $set: meta },
          { upsert: true }
        );
        console.log('[setMetadata] ✅ MongoDB update result:', {
          matched: result.matchedCount,
          modified: result.modifiedCount,
          upserted: result.upsertedCount,
          upsertedId: result.upsertedId
        });
      } else {
        console.log('[setMetadata] ⚠️  No chatsCollection, skipping DB save');
      }
      // notify the specific owner only
      try {
        if (ownerId) {
          console.log('[setMetadata] 📢 Notifying owner:', ownerId);
          sendToOwnerOrBroadcast(ownerId, 'metadata:updated', Object.assign({ userId: uid }, meta));
        } else {
          console.log('[setMetadata] ℹ️  No ownerId, skipping owner notification');
        }
      } catch(e){ console.error('[setMetadata] ❌ emit metadata update error', e); }
    } catch (e) { console.error('[setMetadata] ❌ socket setMetadata error', e); }
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
    console.log('[HTTP metadata] 📝 POST /chats/:userId/metadata');
    console.log('[HTTP metadata] 👤 userId:', uid);
    console.log('[HTTP metadata] 📦 body:', JSON.stringify(req.body, null, 2));
    const { username, useremail, userphone, ownerId } = req.body || {};
    const meta = { username: username || null, useremail: useremail || null, userphone: userphone || null, ownerId: ownerId || null };
    console.log('[HTTP metadata] 💾 Storing in buffer:', meta);
    metadataBuffer.set(uid, meta);
    if (chatsCollection) {
      console.log('[HTTP metadata] 🗄️  Upserting to MongoDB...');
      const result = await chatsCollection.updateOne(
        { userId: uid },
        { $setOnInsert: { userId: uid, createdAt: new Date() }, $set: meta },
        { upsert: true }
      );
      console.log('[HTTP metadata] ✅ MongoDB update result:', {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });
    } else {
      console.log('[HTTP metadata] ⚠️  No chatsCollection, skipping DB save');
    }
    // notify owners
    try { 
      console.log('[HTTP metadata] 📢 Notifying owners room');
      io.to('owners').emit('metadata:updated', Object.assign({ userId: uid }, meta)); 
    } catch(e){ console.error('[HTTP metadata] ❌ emit metadata update error', e); }
    console.log('[HTTP metadata] ✅ Success');
    res.json({ ok: true });
  } catch (e) { 
    console.error('[HTTP metadata] ❌ metadata save error', e); 
    res.status(500).json({ error: 'failed' }); 
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Socket server listening on http://localhost:${PORT}`));

// ============ AI MANAGEMENT API ENDPOINTS ============
const {
  storePdfResource,
  storeTxtResource,
  storeJsonResource,
  deleteOwnerResources,
  getOwnerResourceStats,
} = require('./functions/storeResources');

// Upload and store PDF resource for owner
app.post('/api/ai/upload-pdf', async (req, res) => {
  try {
    const { ownerId, pdfPath, metadata } = req.body;
    if (!ownerId || !pdfPath) {
      return res.status(400).json({ error: 'ownerId and pdfPath are required' });
    }
    const result = await storePdfResource(ownerId, pdfPath, metadata);
    res.json(result);
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload and store TXT resource for owner
app.post('/api/ai/upload-txt', async (req, res) => {
  try {
    const { ownerId, txtPath, metadata } = req.body;
    if (!ownerId || !txtPath) {
      return res.status(400).json({ error: 'ownerId and txtPath are required' });
    }
    const result = await storeTxtResource(ownerId, txtPath, metadata);
    res.json(result);
  } catch (error) {
    console.error('Error uploading TXT:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload and store JSON resource for owner
app.post('/api/ai/upload-json', async (req, res) => {
  try {
    const { ownerId, jsonData, metadata } = req.body;
    if (!ownerId || !jsonData) {
      return res.status(400).json({ error: 'ownerId and jsonData are required' });
    }
    const result = await storeJsonResource(ownerId, jsonData, metadata);
    res.json(result);
  } catch (error) {
    console.error('Error uploading JSON:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get resource statistics for owner
app.get('/api/ai/stats/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const stats = await getOwnerResourceStats(ownerId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete all resources for owner
app.delete('/api/ai/resources/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const result = await deleteOwnerResources(ownerId);
    res.json(result);
  } catch (error) {
    console.error('Error deleting resources:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset AI for a specific user (reactivate AI)
app.post('/api/ai/reset/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await resetAiForUser(userId);
    res.json({ success: true, message: 'AI reactivated for user' });
  } catch (error) {
    console.error('Error resetting AI:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get AI state for a user
app.get('/api/ai/state/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const state = await getAiStateInfo(userId);
    res.json(state);
  } catch (error) {
    console.error('Error getting AI state:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ KNOWLEDGE MANAGER API ENDPOINTS ============
const {
  saveQnA,
  getQnAs,
  deleteQnA,
  saveProduct,
  getProducts,
  deleteProduct,
  storeFileContent,
} = require('./functions/knowledgeManager');

// Q&A Management
app.get('/api/knowledge/qna/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const qnas = await getQnAs(ownerId);
    res.json({ success: true, data: qnas });
  } catch (error) {
    console.error('Error fetching Q&As:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/knowledge/qna', async (req, res) => {
  try {
    const { ownerId, _id, question, answer } = req.body;
    if (!ownerId || !question || !answer) {
      return res.status(400).json({ success: false, error: 'ownerId, question, and answer are required' });
    }
    const result = await saveQnA(ownerId, { _id, question, answer });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error saving Q&A:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/knowledge/qna/:ownerId/:qnaId', async (req, res) => {
  try {
    const { ownerId, qnaId } = req.params;
    const result = await deleteQnA(ownerId, qnaId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting Q&A:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Product/Service Management
app.get('/api/knowledge/products/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const products = await getProducts(ownerId);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/knowledge/products', async (req, res) => {
  try {
    const { ownerId, _id, name, description } = req.body;
    if (!ownerId || !name || !description) {
      return res.status(400).json({ success: false, error: 'ownerId, name, and description are required' });
    }
    const result = await saveProduct(ownerId, { _id, name, description });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error saving product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/knowledge/products/:ownerId/:productId', async (req, res) => {
  try {
    const { ownerId, productId } = req.params;
    const result = await deleteProduct(ownerId, productId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// File Upload (PDF, TXT, JSON)
app.post('/api/knowledge/upload', async (req, res) => {
  try {
    const { ownerId, fileType, content, metadata } = req.body;
    if (!ownerId || !fileType || !content) {
      return res.status(400).json({ success: false, error: 'ownerId, fileType, and content are required' });
    }
    const result = await storeFileContent(ownerId, fileType, content, metadata);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save/Update Company Website
app.post('/api/knowledge/website', async (req, res) => {
  try {
    const { ownerId, websiteUrl } = req.body;
    if (!ownerId) {
      return res.status(400).json({ success: false, error: 'ownerId is required' });
    }
    
    const knowledgebase = db.collection('knowledgebase');
    await knowledgebase.updateOne(
      { ownerId },
      { $set: { companyWebsite: websiteUrl, updatedAt: new Date() } },
      { upsert: true }
    );
    
    res.json({ success: true, message: 'Company website saved successfully' });
  } catch (error) {
    console.error('Error saving company website:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Company Info
app.get('/api/knowledge/website/:ownerId', async (req, res) => {
  try {
    const { ownerId } = req.params;
    const knowledgebase = db.collection('knowledgebase');
    const ownerInfo = await knowledgebase.findOne({ ownerId });
    
    res.json({ 
      success: true, 
      data: { 
        companyWebsite: ownerInfo?.companyWebsite || '' 
      } 
    });
  } catch (error) {
    console.error('Error fetching company website:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chatui settings by ownerId
app.get('/api/chatui/settings', async (req, res) => {
  try {
    const { ownerId } = req.query;
    
    if (!ownerId) {
      return res.status(400).json({ success: false, error: 'ownerId query parameter is required' });
    }
    
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    const chatuiCollection = db.collection('chatui');
    
    const chatuiSettings = await chatuiCollection.findOne({ ownerId });
    
    if (!chatuiSettings) {
      return res.status(404).json({ success: false, error: 'Chat UI settings not found for this owner' });
    }
    
    res.json({ success: true, data: chatuiSettings });
  } catch (error) {
    console.error('Error fetching chatui settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

