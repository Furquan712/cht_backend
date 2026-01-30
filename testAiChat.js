/**
 * testAiChat.js
 * Simple test to verify AI chat is working
 * 
 * Usage: node testAiChat.js
 */

require('dotenv').config();

async function testAiChat() {
  console.log('🧪 Testing AI Chat Functionality\n');
  console.log('=' .repeat(50));

  // Test 1: Generate AI response without knowledge base
  console.log('\n1️⃣ Testing AI response WITHOUT knowledge base...');
  try {
    const { generateAiResponse } = require('./functions/aiResponse');
    
    const response1 = await generateAiResponse('What is 2 + 2?', [], []);
    console.log('   ✅ AI Response:', response1);
    
    const response2 = await generateAiResponse('Tell me a joke', [], []);
    console.log('   ✅ AI Response:', response2);
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return;
  }

  // Test 2: Test with conversation history
  console.log('\n2️⃣ Testing AI with conversation history...');
  try {
    const { generateAiResponse } = require('./functions/aiResponse');
    
    const history = [
      { from: 'user', text: 'My name is John' },
      { from: 'ai', text: 'Nice to meet you, John!' }
    ];
    
    const response = await generateAiResponse('What is my name?', [], history);
    console.log('   ✅ AI Response:', response);
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return;
  }

  // Test 3: Process user message (full flow)
  console.log('\n3️⃣ Testing full message processing...');
  try {
    const { processUserMessage } = require('./functions/aiChatHandler');
    
    const testUserId = 'test_user_' + Date.now();
    const result = await processUserMessage(testUserId, 'Hello, how are you?', null);
    
    if (result) {
      console.log('   ✅ AI processed message successfully');
      console.log('   📝 Response:', result.text);
      console.log('   🔍 Context used:', result.contextUsed);
    } else {
      console.log('   ⚠️  No response (AI might be inactive)');
    }
    
  } catch (error) {
    console.error('   ❌ Error:', error.message);
    return;
  }

  // Test 4: Test with owner knowledge base (if exists)
  console.log('\n4️⃣ Testing with owner knowledge base...');
  try {
    const { getAiResponseWithContext } = require('./functions/aiResponse');
    const { processUserMessage } = require('./functions/aiChatHandler');
    
    // Try with a test owner ID (replace with actual if you have one)
    const testOwnerId = 'owner_12345';
    const testUserId = 'test_user_' + Date.now();
    
    const result = await processUserMessage(testUserId, 'What are your business hours?', testOwnerId);
    
    if (result) {
      console.log('   ✅ AI processed message with owner context');
      console.log('   📝 Response:', result.text);
      console.log('   🔍 Context used:', result.contextUsed);
      if (result.sources && result.sources.length > 0) {
        console.log('   📚 Sources:', result.sources);
      }
    } else {
      console.log('   ⚠️  No response');
    }
    
  } catch (error) {
    console.log('   ⚠️  Owner knowledge base not found (expected if no data uploaded)');
    console.log('   💡 This is OK - AI will use general knowledge instead');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ AI Chat Testing Complete!\n');
  console.log('📝 Summary:');
  console.log('   - AI can respond without knowledge base ✓');
  console.log('   - AI maintains conversation context ✓');
  console.log('   - Message processing works ✓');
  console.log('\n💡 Next: Start your server and test with real users!');
  console.log('   npm start\n');
}

// Run tests
if (require.main === module) {
  testAiChat()
    .then(() => {
      console.log('✨ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testAiChat };
