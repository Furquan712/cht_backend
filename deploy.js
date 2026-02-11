const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const DEPLOY_CONFIG = {
  // CDN or server URL where you want to upload the file
  uploadUrl: process.env.DEPLOY_URL || 'https://your-cdn.com/upload',
  apiKey: process.env.DEPLOY_API_KEY || '',
  
  // Or you can use SCP/SFTP
  method: process.env.DEPLOY_METHOD || 'http', // 'http', 'scp', 'ftp'
};

const DIST_DIR = path.join(__dirname, 'dist');

async function deploy() {
  console.log('🚀 Starting deployment...\n');
  
  // Check if dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error('❌ dist/ directory not found. Run `npm run build` first.');
    process.exit(1);
  }
  
  // Get files to deploy
  const files = fs.readdirSync(DIST_DIR).filter(f => f.endsWith('.js'));
  
  if (files.length === 0) {
    console.error('❌ No files found in dist/ directory.');
    process.exit(1);
  }
  
  console.log(`📦 Files to deploy:`);
  files.forEach(file => {
    const filePath = path.join(DIST_DIR, file);
    const size = (fs.statSync(filePath).size / 1024).toFixed(2);
    console.log(`   - ${file} (${size} KB)`);
  });
  
  console.log('\n');
  
  // Deployment methods
  if (DEPLOY_CONFIG.method === 'http') {
    await deployViaHTTP(files);
  } else if (DEPLOY_CONFIG.method === 'copy') {
    await deployViaCopy(files);
  } else {
    console.log('ℹ️  No deployment method configured.');
    console.log('   Set DEPLOY_METHOD and DEPLOY_URL in your environment.');
    console.log('\n📝 Manual deployment steps:');
    console.log('   1. Upload files from dist/ to your CDN or server');
    console.log('   2. Update your HTML to reference the new script URL');
    console.log(`   3. Example: <script src="https://your-cdn.com/script.min.js?cid=YOUR_OWNER_ID"></script>\n`);
  }
}

async function deployViaHTTP(files) {
  // Example HTTP upload - customize based on your CDN/server
  console.log('📤 Deploying via HTTP...\n');
  
  for (const file of files) {
    const filePath = path.join(DIST_DIR, file);
    const fileContent = fs.readFileSync(filePath);
    
    // This is a template - replace with your actual upload logic
    console.log(`   Uploading ${file}...`);
    
    // Example: You might use fetch or axios here to upload to your server
    // const formData = new FormData();
    // formData.append('file', fileContent, file);
    // await fetch(DEPLOY_CONFIG.uploadUrl, { method: 'POST', body: formData });
    
    console.log(`   ✅ ${file} uploaded (simulated)`);
  }
  
  console.log('\n✨ Deployment completed!\n');
}

async function deployViaCopy(files) {
  // Copy to a local directory (useful for testing or local deployments)
  const targetDir = process.env.DEPLOY_TARGET_DIR || '../public/scripts';
  const targetPath = path.resolve(__dirname, targetDir);
  
  console.log(`📁 Copying files to ${targetPath}...\n`);
  
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }
  
  for (const file of files) {
    const source = path.join(DIST_DIR, file);
    const target = path.join(targetPath, file);
    
    fs.copyFileSync(source, target);
    console.log(`   ✅ Copied ${file} to ${targetPath}`);
  }
  
  console.log('\n✨ Files copied successfully!\n');
}

// Generate integration instructions
function generateInstructions() {
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
  const dotenv = require('dotenv');
  dotenv.config({ path: path.join(__dirname, envFile) });
  
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  
  console.log('📖 Integration Instructions:\n');
  console.log('Add this code before closing </body> tag in your HTML:\n');
  console.log('```html');
  console.log('<script>');
  console.log('  window.ChatbotConfig = {');
  console.log(`    socketUrl: '${apiBaseUrl}',`);
  console.log(`    apiBase: '${apiBaseUrl}',`);
  console.log("    ownerId: 'YOUR_OWNER_ID' // Replace with actual owner ID");
  console.log('  };');
  console.log('</script>');
  console.log('<script src="https://your-cdn.com/script.min.js"></script>');
  console.log('```\n');
  console.log('Or use the query parameter method:\n');
  console.log('```html');
  console.log('<script src="https://your-cdn.com/script.min.js?cid=YOUR_OWNER_ID"></script>');
  console.log('```\n');
}

// Run deployment
deploy()
  .then(() => {
    generateInstructions();
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });
