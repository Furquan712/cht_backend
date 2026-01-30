/**
 * exampleUploadResources.js
 * Example script showing how to upload resources for an owner
 * 
 * Usage: node exampleUploadResources.js
 */

const {
  storePdfResource,
  storeTxtResource,
  storeJsonResource,
  getOwnerResourceStats,
} = require('./functions/storeResources');

async function uploadExampleResources() {
  // Replace with your actual ownerId
  const ownerId = 'owner_12345';

  console.log(`📤 Uploading resources for owner: ${ownerId}\n`);

  try {
    // Example 1: Upload JSON data (company info, FAQ, etc.)
    console.log('1️⃣ Uploading JSON company information...');
    const companyInfo = {
      name: 'Acme Corporation',
      industry: 'Technology',
      description: 'We provide cutting-edge AI chatbot solutions for businesses.',
      
      contact: {
        email: 'support@acme.com',
        phone: '1-800-ACME-HELP',
        hours: 'Monday-Friday, 9 AM - 6 PM EST'
      },
      
      products: [
        {
          name: 'ChatBot Pro',
          price: '$99/month',
          features: ['AI-powered responses', '24/7 availability', 'Multi-language support']
        },
        {
          name: 'ChatBot Enterprise',
          price: '$299/month',
          features: ['Everything in Pro', 'Custom integrations', 'Dedicated support']
        }
      ],
      
      faq: [
        {
          question: 'What is your refund policy?',
          answer: 'We offer a 30-day money-back guarantee on all plans.'
        },
        {
          question: 'How do I get started?',
          answer: 'Simply sign up on our website and follow the setup wizard.'
        },
        {
          question: 'Do you offer technical support?',
          answer: 'Yes, we provide 24/7 technical support via email and chat.'
        }
      ],

      policies: {
        shipping: 'Digital products - instant delivery',
        returns: '30-day money-back guarantee',
        privacy: 'We never share your data with third parties'
      }
    };

    await storeJsonResource(ownerId, companyInfo, {
      title: 'Company Information',
      category: 'general',
      version: '1.0'
    });
    console.log('   ✅ Company info uploaded\n');

    // Example 2: Upload TXT file (if you have one)
    // Uncomment and modify the path if you have a TXT file
    /*
    console.log('2️⃣ Uploading TXT FAQ document...');
    await storeTxtResource(ownerId, './resources/faq.txt', {
      title: 'Frequently Asked Questions',
      category: 'support'
    });
    console.log('   ✅ FAQ document uploaded\n');
    */

    // Example 3: Upload PDF file (if you have one)
    // Uncomment and modify the path if you have a PDF file
    /*
    console.log('3️⃣ Uploading PDF product manual...');
    await storePdfResource(ownerId, './resources/product_manual.pdf', {
      title: 'Product Manual',
      category: 'documentation'
    });
    console.log('   ✅ Product manual uploaded\n');
    */

    // Example 4: Upload more specific data
    console.log('2️⃣ Uploading additional knowledge...');
    const additionalKnowledge = {
      troubleshooting: {
        'chatbot_not_responding': 'If the chatbot is not responding, try refreshing the page or clearing your browser cache.',
        'slow_responses': 'Slow responses may be due to high traffic. Please try again in a few minutes.',
        'login_issues': 'If you cannot log in, use the "Forgot Password" link or contact support.'
      },
      
      features_guide: {
        'custom_branding': 'You can customize the chatbot colors, logo, and welcome message in the settings panel.',
        'integrations': 'We support integrations with Slack, Discord, WhatsApp, and custom webhooks.',
        'analytics': 'View detailed analytics including conversation counts, user satisfaction, and popular questions.'
      },
      
      pricing_details: {
        'free_trial': 'All new users get a 14-day free trial with full access to Pro features.',
        'payment_methods': 'We accept credit cards, PayPal, and bank transfers for annual plans.',
        'discounts': 'Annual plans receive a 20% discount. Contact sales for enterprise pricing.'
      }
    };

    await storeJsonResource(ownerId, additionalKnowledge, {
      title: 'Knowledge Base',
      category: 'support'
    });
    console.log('   ✅ Additional knowledge uploaded\n');

    // Get statistics
    console.log('📊 Getting resource statistics...');
    const stats = await getOwnerResourceStats(ownerId);
    console.log(`   Collection: ${stats.collectionName}`);
    console.log(`   Total chunks stored: ${stats.pointsCount}`);
    console.log(`   Vectors count: ${stats.vectorsCount}\n`);

    console.log('✅ All resources uploaded successfully!');
    console.log('\n💡 The AI can now answer questions based on this knowledge.');
    console.log('📝 Example questions users can ask:');
    console.log('   - "What are your business hours?"');
    console.log('   - "What is your refund policy?"');
    console.log('   - "How much does ChatBot Pro cost?"');
    console.log('   - "What integrations do you support?"');
    console.log('   - "I\'m having trouble logging in"');

  } catch (error) {
    console.error('❌ Error uploading resources:', error.message);
    console.error(error);
  }
}

// Run the upload
if (require.main === module) {
  uploadExampleResources()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { uploadExampleResources };
