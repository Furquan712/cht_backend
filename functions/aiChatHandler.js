/**
 * aiChatHandler.js
 * Main AI chat handler that manages AI responses in the chat flow
 * AI responds until admin/owner sends a message
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');
const { getAiResponseWithContext } = require('./aiResponse');

// Mongo setup
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'aichatbot';

let chatsCollection = null;
let aiStateCollection = null;

/**
 * Initialize MongoDB collections
 */
async function initMongo() {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const db = client.db(MONGO_DB);
    chatsCollection = db.collection('chats');
    aiStateCollection = db.collection('ai_chat_state');
    console.log('[AI Handler] MongoDB connected');
  } catch (error) {
    console.error('[AI Handler] Mongo init error:', error);
  }
}

// Initialize on module load
initMongo();

/**
 * Check if AI should respond for a user
 * AI is active by default until admin sends a message
 * @param {string} userId - User's unique ID
 * @returns {Promise<boolean>} - True if AI should respond
 */
async function shouldAiRespond(userId) {
  if (!aiStateCollection) return true; // Default: AI is active
  
  try {
    const state = await aiStateCollection.findOne({ userId });
    
    // If no state exists, AI is active by default
    if (!state) {
      return true;
    }
    
    // Return the AI active state (true = AI responds, false = admin has taken over)
    return state.aiActive !== false;
  } catch (error) {
    console.error('[AI Handler] Error checking AI state:', error);
    return true; // Default to AI active on error
  }
}

/**
 * Set AI active state for a user
 * @param {string} userId - User's unique ID
 * @param {boolean} isActive - Whether AI should be active
 */
async function setAiState(userId, isActive) {
  if (!aiStateCollection) return;
  
  try {
    await aiStateCollection.updateOne(
      { userId },
      {
        $set: {
          aiActive: isActive,
          lastUpdated: new Date(),
        },
      },
      { upsert: true }
    );
    console.log(`[AI Handler] AI state for ${userId} set to ${isActive}`);
  } catch (error) {
    console.error('[AI Handler] Error setting AI state:', error);
  }
}

/**
 * Deactivate AI when admin sends a message
 * @param {string} userId - User's unique ID
 */
async function deactivateAiForUser(userId) {
  await setAiState(userId, false);
}

/**
 * Activate AI for a user (e.g., when starting new chat)
 * @param {string} userId - User's unique ID
 */
async function activateAiForUser(userId) {
  await setAiState(userId, true);
}

/**
 * Get conversation history for AI context
 * @param {string} userId - User's unique ID
 * @param {number} limit - Number of recent messages to retrieve
 * @returns {Promise<Array>} - Conversation history
 */
async function getConversationHistory(userId, limit = 10) {
  if (!chatsCollection) return [];
  
  try {
    const chat = await chatsCollection.findOne({ userId });
    
    if (!chat || !chat.conversation) {
      return [];
    }
    
    // Return last N messages
    return chat.conversation.slice(-limit);
  } catch (error) {
    console.error('[AI Handler] Error getting conversation history:', error);
    return [];
  }
}

/**
 * Process user message and generate AI response if needed
 * @param {string} userId - User's unique ID
 * @param {string} userMessage - User's message
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<object|null>} - AI response object or null if AI shouldn't respond
 */
async function processUserMessage(userId, userMessage, ownerId) {
  try {
    // Check if AI should respond
    const aiShouldRespond = await shouldAiRespond(userId);
    
    if (!aiShouldRespond) {
      console.log(`[AI Handler] AI disabled for user ${userId}, waiting for admin`);
      return null;
    }
    
    // Get conversation history for context
    const conversationHistory = await getConversationHistory(userId);
    
    // Generate AI response with context from owner's knowledge base
    // If no ownerId, use general AI knowledge without specific context
    let aiResult;
    if (ownerId) {
      aiResult = await getAiResponseWithContext(ownerId, userMessage, conversationHistory);
    } else {
      console.log(`[AI Handler] No ownerId for user ${userId}, using general AI knowledge`);
      const { generateAiResponse } = require('./aiResponse');
      const response = await generateAiResponse(userMessage, [], conversationHistory);
      aiResult = {
        response,
        contextUsed: false,
        sources: [],
      };
    }
    
    // Store AI response in MongoDB
    if (chatsCollection) {
      const aiMessageObj = {
        from: 'ai',
        text: aiResult.response,
        ts: Date.now(),
        contextUsed: aiResult.contextUsed,
        sources: aiResult.sources,
      };
      
      await chatsCollection.updateOne(
        { userId },
        {
          $push: { conversation: aiMessageObj },
        }
      );
    }
    
    return {
      from: 'ai',
      text: aiResult.response,
      userId,
      ts: Date.now(),
      contextUsed: aiResult.contextUsed,
      sources: aiResult.sources,
    };
  } catch (error) {
    console.error('[AI Handler] Error processing user message:', error);
    
    // Return friendly error message
    return {
      from: 'ai',
      text: "I apologize, but I'm having trouble processing your message right now. Please try again or wait for our team to assist you.",
      userId,
      ts: Date.now(),
      error: true,
    };
  }
}

/**
 * Handle admin/owner message (deactivates AI)
 * @param {string} userId - User's unique ID
 */
async function handleAdminMessage(userId) {
  await deactivateAiForUser(userId);
  console.log(`[AI Handler] Admin took over chat for user ${userId}`);
}

/**
 * Reset AI state for a user (reactivate AI)
 * @param {string} userId - User's unique ID
 */
async function resetAiForUser(userId) {
  await activateAiForUser(userId);
  console.log(`[AI Handler] AI reactivated for user ${userId}`);
}

/**
 * Get AI state for a user
 * @param {string} userId - User's unique ID
 * @returns {Promise<object>} - AI state information
 */
async function getAiStateInfo(userId) {
  const isActive = await shouldAiRespond(userId);
  
  return {
    userId,
    aiActive: isActive,
    status: isActive ? 'AI is responding' : 'Admin has taken over',
  };
}

module.exports = {
  processUserMessage,
  handleAdminMessage,
  resetAiForUser,
  shouldAiRespond,
  activateAiForUser,
  deactivateAiForUser,
  getAiStateInfo,
  getConversationHistory,
};
