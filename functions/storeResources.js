/**
 * storeResources.js
 * Store owner resources (PDF, TXT, JSON) as embeddings in Qdrant Vector DB
 * Each owner has separate collections based on ownerId
 */

require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs').promises;
const path = require('path');

// Initialize Qdrant client
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_HOST,
  apiKey: process.env.QDRANT_API_KEY,
});

/**
 * Generate OpenAI embeddings for text
 * @param {string} text - Text to generate embeddings for
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set in environment variables');
  }

  const url = 'https://api.openai.com/v1/embeddings';
  const body = {
    model: 'text-embedding-3-small',
    input: text,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Create or ensure collection exists for an owner
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<string>} - Collection name
 */
async function ensureOwnerCollection(ownerId) {
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    // Check if collection exists
    const collections = await qdrantClient.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);
    
    if (!exists) {
      // Create collection with proper vector size (1536 for text-embedding-3-small)
      await qdrantClient.createCollection(collectionName, {
        vectors: {
          size: 1536,
          distance: 'Cosine',
        },
      });
      console.log(`Created collection: ${collectionName}`);
    }
    
    return collectionName;
  } catch (error) {
    console.error('Error ensuring collection:', error);
    throw error;
  }
}

/**
 * Split text into chunks for better embedding
 * @param {string} text - Text to split
 * @param {number} chunkSize - Size of each chunk
 * @param {number} overlap - Overlap between chunks
 * @returns {string[]} - Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Store PDF text as embeddings in Qdrant
 * @param {string} ownerId - Owner's unique ID
 * @param {string} pdfPath - Path to PDF file
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<object>} - Storage result
 */
async function storePdfResource(ownerId, pdfPath, metadata = {}) {
  try {
    // Import PDF conversion function
    const { convertPdfToText } = require('./pdftoText.js');
    
    // Convert PDF to text
    const text = await convertPdfToText(pdfPath);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text extracted from PDF');
    }
    
    // Store as text resource
    return await storeTextResource(ownerId, text, {
      ...metadata,
      sourceType: 'pdf',
      sourcePath: pdfPath,
      fileName: path.basename(pdfPath),
    });
  } catch (error) {
    console.error('Error storing PDF resource:', error);
    throw error;
  }
}

/**
 * Store TXT file as embeddings in Qdrant
 * @param {string} ownerId - Owner's unique ID
 * @param {string} txtPath - Path to TXT file
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<object>} - Storage result
 */
async function storeTxtResource(ownerId, txtPath, metadata = {}) {
  try {
    const text = await fs.readFile(txtPath, 'utf-8');
    
    if (!text || text.trim().length === 0) {
      throw new Error('Text file is empty');
    }
    
    return await storeTextResource(ownerId, text, {
      ...metadata,
      sourceType: 'txt',
      sourcePath: txtPath,
      fileName: path.basename(txtPath),
    });
  } catch (error) {
    console.error('Error storing TXT resource:', error);
    throw error;
  }
}

/**
 * Store JSON data as embeddings in Qdrant
 * @param {string} ownerId - Owner's unique ID
 * @param {string} jsonPath - Path to JSON file or JSON object
 * @param {object} metadata - Additional metadata (optional)
 * @returns {Promise<object>} - Storage result
 */
async function storeJsonResource(ownerId, jsonPath, metadata = {}) {
  try {
    let jsonData;
    let fileName = 'inline_json';
    
    // Check if jsonPath is a string (file path) or object
    if (typeof jsonPath === 'string') {
      const fileContent = await fs.readFile(jsonPath, 'utf-8');
      jsonData = JSON.parse(fileContent);
      fileName = path.basename(jsonPath);
    } else if (typeof jsonPath === 'object') {
      jsonData = jsonPath;
    } else {
      throw new Error('Invalid JSON input');
    }
    
    // Convert JSON to readable text
    const text = JSON.stringify(jsonData, null, 2);
    
    return await storeTextResource(ownerId, text, {
      ...metadata,
      sourceType: 'json',
      sourcePath: typeof jsonPath === 'string' ? jsonPath : 'inline',
      fileName,
      jsonStructure: Object.keys(jsonData),
    });
  } catch (error) {
    console.error('Error storing JSON resource:', error);
    throw error;
  }
}

/**
 * Core function to store text as embeddings
 * @param {string} ownerId - Owner's unique ID
 * @param {string} text - Text content
 * @param {object} metadata - Additional metadata
 * @returns {Promise<object>} - Storage result
 */
async function storeTextResource(ownerId, text, metadata = {}) {
  try {
    // Ensure collection exists
    const collectionName = await ensureOwnerCollection(ownerId);
    
    // Split text into chunks
    const chunks = splitTextIntoChunks(text);
    console.log(`Split text into ${chunks.length} chunks for owner ${ownerId}`);
    
    // Generate embeddings and store each chunk
    const points = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await generateEmbedding(chunk);
      
      points.push({
        id: Date.now() + i, // Simple ID generation
        vector: embedding,
        payload: {
          text: chunk,
          chunkIndex: i,
          totalChunks: chunks.length,
          ownerId,
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });
    }
    
    // Upsert points to Qdrant
    await qdrantClient.upsert(collectionName, {
      wait: true,
      points,
    });
    
    console.log(`Stored ${points.length} chunks for owner ${ownerId} in ${collectionName}`);
    
    return {
      success: true,
      collectionName,
      chunksStored: points.length,
      ownerId,
      metadata,
    };
  } catch (error) {
    console.error('Error storing text resource:', error);
    throw error;
  }
}

/**
 * Delete all resources for an owner
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<object>} - Deletion result
 */
async function deleteOwnerResources(ownerId) {
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    await qdrantClient.deleteCollection(collectionName);
    console.log(`Deleted collection: ${collectionName}`);
    return { success: true, collectionName };
  } catch (error) {
    console.error('Error deleting owner resources:', error);
    throw error;
  }
}

/**
 * Get resource statistics for an owner
 * @param {string} ownerId - Owner's unique ID
 * @returns {Promise<object>} - Statistics
 */
async function getOwnerResourceStats(ownerId) {
  const collectionName = `owner_${ownerId}_knowledge`;
  
  try {
    const info = await qdrantClient.getCollection(collectionName);
    return {
      ownerId,
      collectionName,
      pointsCount: info.points_count,
      vectorsCount: info.vectors_count,
    };
  } catch (error) {
    if (error.message.includes('Not found')) {
      return {
        ownerId,
        collectionName,
        pointsCount: 0,
        vectorsCount: 0,
        message: 'No resources stored yet',
      };
    }
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  ensureOwnerCollection,
  storePdfResource,
  storeTxtResource,
  storeJsonResource,
  storeTextResource,
  deleteOwnerResources,
  getOwnerResourceStats,
};
