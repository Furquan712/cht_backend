/**
 * Knowledge Manager - Handles Q&A and Product/Service embeddings
 * Stores data in both MongoDB (for management) and Qdrant (for AI search)
 */

const { MongoClient, ObjectId } = require('mongodb');
const { QdrantClient } = require('@qdrant/js-client-rest');
const OpenAI = require('openai');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'aichatbot';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || null;

let openai = null;
let qdrantClient = null;
let mongoClient = null;
let db = null;

function initClients() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
}

async function getDb() {
  if (!db) {
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    db = mongoClient.db(MONGO_DB);
  }
  return db;
}

/**
 * Generate embeddings using OpenAI
 */
async function generateEmbedding(text) {
  try {
    initClients();
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Ensure Qdrant collection exists for owner
 */
async function ensureQdrantCollection(ownerId) {
  initClients();
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    await qdrantClient.getCollection(collectionName);
    console.log(`[Qdrant] Collection ${collectionName} exists`);
  } catch (error) {
    // Collection doesn't exist, create it
    console.log(`[Qdrant] Creating collection ${collectionName}`);
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: 1536, // text-embedding-3-small dimension
        distance: 'Cosine',
      },
    });
  }
  
  return collectionName;
}

// ==================== Q&A MANAGEMENT ====================

/**
 * Add or Update Q&A
 */
async function saveQnA(ownerId, qnaData) {
  try {
    const database = await getDb();
    const qnaCollection = database.collection('qna');
    const collectionName = await ensureQdrantCollection(ownerId);
    
    const { _id, question, answer } = qnaData;
    
    // Generate embedding from question + answer
    const embeddingText = `Question: ${question}\nAnswer: ${answer}`;
    const embedding = await generateEmbedding(embeddingText);
    
    // Save to MongoDB
    let qnaId;
    if (_id) {
      // Update existing
      await qnaCollection.updateOne(
        { _id: new ObjectId(_id), ownerId },
        {
          $set: {
            question,
            answer,
            updatedAt: new Date(),
          },
        }
      );
      qnaId = _id;
    } else {
      // Create new
      const result = await qnaCollection.insertOne({
        ownerId,
        question,
        answer,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      qnaId = result.insertedId.toString();
    }
    
    // Upsert to Qdrant
    await qdrantClient.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: `qna_${qnaId}`,
          vector: embedding,
          payload: {
            type: 'qna',
            id: qnaId,
            ownerId,
            question,
            answer,
            text: embeddingText,
          },
        },
      ],
    });
    
    console.log(`[KnowledgeManager] Saved Q&A ${qnaId} for owner ${ownerId}`);
    return { success: true, id: qnaId };
  } catch (error) {
    console.error('Error saving Q&A:', error);
    throw error;
  }
}

/**
 * Get all Q&As for an owner
 */
async function getQnAs(ownerId) {
  try {
    const database = await getDb();
    const qnaCollection = database.collection('qna');
    
    const qnas = await qnaCollection
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray();
    
    return qnas;
  } catch (error) {
    console.error('Error getting Q&As:', error);
    throw error;
  }
}

/**
 * Delete Q&A
 */
async function deleteQnA(ownerId, qnaId) {
  try {
    const database = await getDb();
    const qnaCollection = database.collection('qna');
    const collectionName = `owner_${ownerId}_knowledge`;
    
    // Delete from MongoDB
    await qnaCollection.deleteOne({ _id: new ObjectId(qnaId), ownerId });
    
    // Delete from Qdrant
    try {
      await qdrantClient.delete(collectionName, {
        wait: true,
        points: [`qna_${qnaId}`],
      });
    } catch (error) {
      console.warn('Error deleting from Qdrant (may not exist):', error.message);
    }
    
    console.log(`[KnowledgeManager] Deleted Q&A ${qnaId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting Q&A:', error);
    throw error;
  }
}

// ==================== PRODUCT/SERVICE MANAGEMENT ====================

/**
 * Add or Update Product/Service
 */
async function saveProduct(ownerId, productData) {
  try {
    const database = await getDb();
    const productsCollection = database.collection('products');
    const collectionName = await ensureQdrantCollection(ownerId);
    
    const { _id, name, description } = productData;
    
    // Generate embedding from name + description
    const embeddingText = `Product/Service: ${name}\nDescription: ${description}`;
    const embedding = await generateEmbedding(embeddingText);
    
    // Save to MongoDB
    let productId;
    if (_id) {
      // Update existing
      await productsCollection.updateOne(
        { _id: new ObjectId(_id), ownerId },
        {
          $set: {
            name,
            description,
            updatedAt: new Date(),
          },
        }
      );
      productId = _id;
    } else {
      // Create new
      const result = await productsCollection.insertOne({
        ownerId,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      productId = result.insertedId.toString();
    }
    
    // Upsert to Qdrant
    await qdrantClient.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: `product_${productId}`,
          vector: embedding,
          payload: {
            type: 'product',
            id: productId,
            ownerId,
            name,
            description,
            text: embeddingText,
          },
        },
      ],
    });
    
    console.log(`[KnowledgeManager] Saved product ${productId} for owner ${ownerId}`);
    return { success: true, id: productId };
  } catch (error) {
    console.error('Error saving product:', error);
    throw error;
  }
}

/**
 * Get all Products/Services for an owner
 */
async function getProducts(ownerId) {
  try {
    const database = await getDb();
    const productsCollection = database.collection('products');
    
    const products = await productsCollection
      .find({ ownerId })
      .sort({ createdAt: -1 })
      .toArray();
    
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    throw error;
  }
}

/**
 * Delete Product/Service
 */
async function deleteProduct(ownerId, productId) {
  try {
    const database = await getDb();
    const productsCollection = database.collection('products');
    const collectionName = `owner_${ownerId}_knowledge`;
    
    // Delete from MongoDB
    await productsCollection.deleteOne({ _id: new ObjectId(productId), ownerId });
    
    // Delete from Qdrant
    try {
      await qdrantClient.delete(collectionName, {
        wait: true,
        points: [`product_${productId}`],
      });
    } catch (error) {
      console.warn('Error deleting from Qdrant (may not exist):', error.message);
    }
    
    console.log(`[KnowledgeManager] Deleted product ${productId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}

// ==================== FILE UPLOAD (PDF/TXT/JSON) ====================

/**
 * Store file content as embeddings
 * This integrates with existing storeResources.js functions
 */
async function storeFileContent(ownerId, fileType, content, metadata = {}) {
  const {
    storePdfResource,
    storeTxtResource,
    storeJsonResource,
  } = require('./storeResources');
  
  try {
    let result;
    
    switch (fileType) {
      case 'pdf':
        result = await storePdfResource(ownerId, content, metadata);
        break;
      case 'txt':
        result = await storeTxtResource(ownerId, content, metadata);
        break;
      case 'json':
        result = await storeJsonResource(ownerId, content, metadata);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error storing file content:', error);
    throw error;
  }
}

module.exports = {
  saveQnA,
  getQnAs,
  deleteQnA,
  saveProduct,
  getProducts,
  deleteProduct,
  storeFileContent,
  generateEmbedding,
};
