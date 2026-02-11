const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const dotenv = require('dotenv');
const chokidar = require('chokidar');

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isWatch = process.argv.includes('--watch');

// Load environment variables
const envFile = isProduction ? '.env.production' : '.env.development';
const envPath = path.join(__dirname, envFile);

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ Loaded environment from ${envFile}`);
} else {
  console.warn(`⚠️  ${envFile} not found, using defaults`);
}

// Configuration
const config = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3001',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:3001',
  WIDGET_VERSION: process.env.WIDGET_VERSION || '1.0.0'
};

console.log(`\n🔧 Build Configuration (${NODE_ENV}):`);
console.log(`   API_BASE_URL: ${config.API_BASE_URL}`);
console.log(`   SOCKET_URL: ${config.SOCKET_URL}`);
console.log(`   WIDGET_VERSION: ${config.WIDGET_VERSION}\n`);

// Source and destination paths
const SOURCE_FILE = path.join(__dirname, 'script.js');
const DIST_DIR = path.join(__dirname, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, 'cnvrtss.bundle.js');
const OUTPUT_MIN_FILE = path.join(DIST_DIR, 'cnvrtss.bundle.min.js');

// Ensure dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

// Build function
async function build() {
  try {
    console.log(`🔨 Building widget...`);
    
    // Read source file
    let sourceCode = fs.readFileSync(SOURCE_FILE, 'utf8');
    
    // Replace environment variables (using template literals style replacements)
    sourceCode = sourceCode
      .replace(/const SOCKET_URL = cfg\.socketUrl \|\| cfg\.socket \|\| '[^']*';/g, 
        `const SOCKET_URL = cfg.socketUrl || cfg.socket || '${config.SOCKET_URL}';`)
      .replace(/const apiBase = cfgGlobal\.apiBase \|\|/g,
        `const apiBase = cfgGlobal.apiBase || '${config.API_BASE_URL}' ||`);
    
    // Add version comment at the top
    const versionComment = `/**
 * AIOFC Chat Widget
 * Version: ${config.WIDGET_VERSION}
 * Environment: ${NODE_ENV}
 * Built: ${new Date().toISOString()}
 */\n\n`;
    
    sourceCode = versionComment + sourceCode;
    
    // Write development version (readable)
    fs.writeFileSync(OUTPUT_FILE, sourceCode);
    console.log(`✅ Development build: ${OUTPUT_FILE}`);
    
    // Minify for production
    if (isProduction) {
      const minified = await minify(sourceCode, {
        compress: {
          dead_code: true,
          drop_console: false, // Keep console for debugging
          drop_debugger: true,
          pure_funcs: ['console.debug'], // Remove console.debug in production
          passes: 2
        },
        mangle: {
          toplevel: false,
          reserved: ['ChatbotConfig', 'AIOFC_Chat'] // Don't mangle public API
        },
        format: {
          comments: /^!/,
          preamble: versionComment.replace(/\n\n$/, '')
        }
      });
      
      if (minified.error) {
        throw minified.error;
      }
      
      fs.writeFileSync(OUTPUT_MIN_FILE, minified.code);
      console.log(`✅ Production build (minified): ${OUTPUT_MIN_FILE}`);
      
      // Show size comparison
      const originalSize = (sourceCode.length / 1024).toFixed(2);
      const minifiedSize = (minified.code.length / 1024).toFixed(2);
      const savings = ((1 - minified.code.length / sourceCode.length) * 100).toFixed(1);
      
      console.log(`\n📊 Size comparison:`);
      console.log(`   Original: ${originalSize} KB`);
      console.log(`   Minified: ${minifiedSize} KB`);
      console.log(`   Savings: ${savings}%\n`);
    }
    
    console.log(`✨ Build completed successfully!\n`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Watch mode
if (isWatch) {
  console.log(`👀 Watching for changes in ${SOURCE_FILE}...\n`);
  
  const watcher = chokidar.watch(SOURCE_FILE, {
    persistent: true,
    ignoreInitial: false
  });
  
  watcher.on('change', (path) => {
    console.log(`\n📝 File changed: ${path}`);
    build();
  });
  
  watcher.on('add', (path) => {
    console.log(`\n➕ File added: ${path}`);
    build();
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping watch mode...');
    watcher.close();
    process.exit(0);
  });
  
} else {
  // Single build
  build();
}
