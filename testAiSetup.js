/**
 * testAiSetup.js
 * Test script to verify AI chatbot setup and functionality
 * 
 * Usage: node testAiSetup.js
 */

require('dotenv').config();

async function testSetup() {
  console.log('🤖 AI Chatbot Setup Test\n');
  console.log('=' .repeat(50));

  // 1. Check environment variables
  console.log('\n✓ Checking Environment Variables...');
  const requiredVars = ['MONGODB_URI', 'QDRANT_API_KEY', 'QDRANT_HOST', 'OPENAI_API_KEY'];
  let allVarsPresent = true;

  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
    } else {
      console.log(`  ❌ ${varName}: MISSING`);
      allVarsPresent = false;
    }
  });

  if (!allVarsPresent) {
    console.error('\n❌ Some environment variables are missing. Please check your .env file.');
    return;
  }

  // 2. Test MongoDB connection
  console.log('\n✓ Testing MongoDB Connection...');
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log('  ✅ MongoDB connected successfully');
    await client.close();
  } catch (error) {
    console.error('  ❌ MongoDB connection failed:', error.message);
    return;
  }

  // 3. Test Qdrant connection
  console.log('\n✓ Testing Qdrant Connection...');
  try {
    const { QdrantClient } = require('@qdrant/js-client-rest');
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_HOST,
      apiKey: process.env.QDRANT_API_KEY,
    });
    const collections = await qdrantClient.getCollections();
    console.log(`  ✅ Qdrant connected successfully`);
    console.log(`  📊 Existing collections: ${collections.collections.length}`);
    collections.collections.forEach(col => {
      console.log(`     - ${col.name}`);
    });
  } catch (error) {
    console.error('  ❌ Qdrant connection failed:', error.message);
    return;
  }

  // 4. Test OpenAI embedding generation
  console.log('\n✓ Testing OpenAI Embeddings...');
  try {
    const { generateEmbedding } = require('./functions/storeResources');
    const embedding = await generateEmbedding('Hello, this is a test message');
    console.log(`  ✅ OpenAI embeddings working (vector size: ${embedding.length})`);
  } catch (error) {
    console.error('  ❌ OpenAI embedding failed:', error.message);
    return;
  }

  // 5. Test AI response generation
  console.log('\n✓ Testing AI Response Generation...');
  try {
    const { generateAiResponse } = require('./functions/aiResponse');
    const response = await generateAiResponse('What is 2+2?', [], []);
    console.log(`  ✅ AI response generated successfully`);
    console.log(`  💬 Sample response: "${response.substring(0, 50)}..."`);
  } catch (error) {
    console.error('  ❌ AI response generation failed:', error.message);
    return;
  }

  // 6. Test resource storage (with sample JSON)
  console.log('\n✓ Testing Resource Storage...');
  try {
    const { storeJsonResource, getOwnerResourceStats, deleteOwnerResources } = require('./functions/storeResources');
    const testOwnerId = 'test_owner_' + Date.now();
    
    // Store sample JSON
    const sampleData = {
      company: 'Test Company',
      hours: 'Mon-Fri 9AM-5PM',
      contact: 'test@example.com',
      faq: [
        { q: 'What are your hours?', a: 'We are open Mon-Fri 9AM-5PM' },
        { q: 'How to contact?', a: 'Email us at test@example.com' }
      ]
    };

    await storeJsonResource(testOwnerId, sampleData, { title: 'Test Data' });
    console.log(`  ✅ Sample resource stored for owner: ${testOwnerId}`);

    // Get stats
    const stats = await getOwnerResourceStats(testOwnerId);
    console.log(`  📊 Stats: ${stats.pointsCount} chunks stored`);

    // Test search
    const { searchOwnerKnowledge } = require('./functions/aiResponse');
    const results = await searchOwnerKnowledge(testOwnerId, 'What are your business hours?');
    console.log(`  🔍 Search results: ${results.length} relevant chunks found`);
    if (results.length > 0) {
      console.log(`  📝 Top result: "${results[0].text.substring(0, 50)}..."`);
    }

    // Clean up test data
    await deleteOwnerResources(testOwnerId);
    console.log(`  🗑️  Test data cleaned up`);
  } catch (error) {
    console.error('  ❌ Resource storage test failed:', error.message);
    return;
  }

  // 7. Summary
  console.log('\n' + '='.repeat(50));
  console.log('✅ All Tests Passed!');
  console.log('\n🎉 Your AI Chatbot is ready to use!\n');
  console.log('Next Steps:');
  console.log('1. Upload your resources using the API endpoints');
  console.log('2. Start the server: npm start');
  console.log('3. Test with a user connection');
  console.log('\nSee AI_CHATBOT_GUIDE.md for detailed documentation\n');
}

// Run tests
testSetup().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
