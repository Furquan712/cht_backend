/**
 * aiResponse.js
 * Generate AI responses using embeddings from Qdrant and OpenAI
 * Retrieves relevant context based on user queries
 */

require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');
const { MongoClient } = require('mongodb');
const { generateEmbedding } = require('./storeResources');

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_HOST,
  apiKey: process.env.QDRANT_API_KEY,
});

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'aichatbot';
let mongoClient = null;
let db = null;

async function getDb() {
  if (!db) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db(MONGO_DB);
  }
  return db;
}

/**
 * Get owner's company website from knowledgebase collection
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<string|null>} - Company website URL or null
 */
async function getOwnerWebsite(ownerId) {
  try {
    const database = await getDb();
    const knowledgebase = database.collection('knowledgebase');
    
    const ownerInfo = await knowledgebase.findOne({ ownerId });
    
    return ownerInfo?.companyWebsite || null;
  } catch (error) {
    console.error('Error fetching owner website:', error);
    return null;
  }
}

/**
 * Search for relevant context from owner's knowledge base
 * @param {string} ownerId - Owner's unique ID
 * @param {string} query - User's query/message
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Relevant context chunks
 */
async function searchOwnerKnowledge(ownerId, query, limit = 3) {
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Search in Qdrant
    const searchResult = await qdrantClient.search(collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
    });
    
    return searchResult.map(result => ({
      text: result.payload.text,
      score: result.score,
      metadata: {
        sourceType: result.payload.sourceType,
        fileName: result.payload.fileName,
        chunkIndex: result.payload.chunkIndex,
      },
    }));
  } catch (error) {
    if (error.message && error.message.includes('Not found')) {
      console.log(`No knowledge base found for owner ${ownerId}`);
      return [];
    }
    console.error('Error searching owner knowledge:', error);
    throw error;
  }
}

/**
 * Generate AI response using OpenAI Chat Completions
 * @param {string} userMessage - User's message
 * @param {Array} context - Relevant context from knowledge base
 * @param {Array} conversationHistory - Previous messages
 * @param {string} websiteUrl - Owner's company website URL
 * @returns {Promise<string>} - AI generated response
 */
async function generateAiResponse(userMessage, context = [], conversationHistory = [], websiteUrl = null) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set in environment variables');
  }

  try {
    // Build context string from relevant chunks
    let contextString = '';
    if (context.length > 0) {
      contextString = 'Relevant information from knowledge base:\n\n';
      context.forEach((ctx, idx) => {
        contextString += `[Source ${idx + 1} - ${ctx.metadata.fileName}]:\n${ctx.text}\n\n`;
      });
    }

    // Add website URL to context if available
    let websiteContext = '';
    if (websiteUrl) {
      websiteContext = `\n\nCompany Website: ${websiteUrl}\nYou can reference this website when answering questions about the company.`;
    }

    // Build system message
    const systemMessage = {
      role: 'system',
      content: context.length > 0 
        ? `You are a helpful and friendly AI customer service assistant. Use the information from the knowledge base below to answer questions accurately and professionally.

${contextString}${websiteContext}

If the provided context contains relevant information, use it to answer the question. If the context doesn't fully address the question, you can supplement with general knowledge but mention that some information may not be from the official knowledge base.

Always be friendly, professional, and concise in your responses.`
        : `You are a helpful and friendly AI customer service assistant.${websiteContext}

Since there is no specific knowledge base available, provide helpful, accurate, and professional responses based on your general knowledge. 

Be conversational, empathetic, and try to assist users to the best of your ability. If you're unsure about something specific to the company or product, kindly mention that a team member can provide more detailed information.

Always be friendly, professional, and concise in your responses.`,
    };

    // Build conversation messages (limit to last 10 for context window)
    const recentHistory = conversationHistory.slice(-10).map(msg => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));

    // Add current user message
    const messages = [
      systemMessage,
      ...recentHistory,
      { role: 'user', content: userMessage },
    ];

    // Call OpenAI Chat Completions API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}

/**
 * Get AI response for user message with context from knowledge base
 * @param {string} ownerId - Owner's unique ID
 * @param {string} userMessage - User's message
 * @param {Array} conversationHistory - Previous messages
 * @returns {Promise<object>} - AI response with metadata
 */
async function getAiResponseWithContext(ownerId, userMessage, conversationHistory = []) {
  try {
    // Get owner's website URL
    const websiteUrl = await getOwnerWebsite(ownerId);
    
    // Search for relevant context
    const context = await searchOwnerKnowledge(ownerId, userMessage);
    
    // Generate AI response with website context
    const aiResponse = await generateAiResponse(userMessage, context, conversationHistory, websiteUrl);
    
    return {
      response: aiResponse,
      contextUsed: context.length > 0,
      websiteUrl: websiteUrl,
      sources: context.map(ctx => ({
        fileName: ctx.metadata.fileName,
        sourceType: ctx.metadata.sourceType,
        relevanceScore: ctx.score,
      })),
    };
  } catch (error) {
    console.error('Error getting AI response with context:', error);
    
    // Fallback: generate response without context but with website
    try {
      const websiteUrl = await getOwnerWebsite(ownerId);
      const fallbackResponse = await generateAiResponse(userMessage, [], conversationHistory, websiteUrl);
      return {
        response: fallbackResponse,
        contextUsed: false,
        websiteUrl: websiteUrl,
        sources: [],
        error: 'Could not access knowledge base, using general AI knowledge',
      };
    } catch (fallbackError) {
      throw new Error('Failed to generate AI response');
    }
  }
}

/**
 * Check if owner has knowledge base
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<boolean>} - True if knowledge base exists
 */
async function hasKnowledgeBase(ownerId) {
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    const collections = await qdrantClient.getCollections();
    return collections.collections.some(c => c.name === collectionName);
  } catch (error) {
    console.error('Error checking knowledge base:', error);
    return false;
  }
}

module.exports = {
  searchOwnerKnowledge,
  generateAiResponse,
  getAiResponseWithContext,
  hasKnowledgeBase,
  getOwnerWebsite,
};
