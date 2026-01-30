# Convertss.com Backend (Chatbot and Gen AI)

A powerful AI-powered chatbot backend with vector search capabilities, real-time communication, and intelligent knowledge management using OpenAI embeddings and Qdrant vector database.

## 🌟 Features

- **Real-time Chat**: Socket.IO based real-time bidirectional communication
- **AI-Powered Responses**: Intelligent responses using OpenAI GPT models
- **Vector Search**: Semantic search using Qdrant vector database
- **Knowledge Management**: Store and retrieve Q&A, products, and services
- **Embeddings Generation**: Convert text to vector embeddings for similarity search
- **Web Scraping**: Extract content from websites for knowledge base
- **PDF Processing**: Parse and extract text from PDF documents
- **MongoDB Integration**: Persistent storage for chats, users, and metadata

## 📁 Project Structure

```
backend/
├── index.js                      # Main server file with Socket.IO
├── package.json                  # Dependencies and scripts
├── .env                          # Environment variables (create this)
├── functions/
│   ├── aiChatHandler.js         # Main AI chat logic
│   ├── aiResponse.js            # AI response generation
│   ├── getEmbeddings.js         # OpenAI embeddings creation
│   ├── knowledgeManager.js      # Knowledge base management
│   ├── storeVecDb.js            # Qdrant vector database operations
│   ├── storeResources.js        # Resource storage utilities
│   ├── scraping.js              # Web scraping functionality
│   └── pdftoText.js             # PDF text extraction
└── README.md                     # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.x
- MongoDB (local or cloud)
- Qdrant Vector Database (cloud or self-hosted)
- OpenAI API Key

### Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create `.env` file**
   ```bash
   touch .env
   ```

4. **Configure environment variables** (see Configuration section below)

5. **Start development server**
   ```bash
   npm start
   ```

## ⚙️ Configuration

Create a `.env` file in the backend directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017
MONGO_DB=aichatbot

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Qdrant Vector Database Configuration
QDRANT_HOST=https://your-qdrant-instance.cloud.qdrant.io
QDRANT_API_KEY=your_qdrant_api_key_here
QDRANT_URL=https://your-qdrant-instance.cloud.qdrant.io:6333

# JWT Configuration (optional)
JWT_SECRET=your_jwt_secret_key_here

# CORS Configuration (optional)
ALLOWED_ORIGINS=http://localhost:3000,https://convertss.com
```

### Getting API Keys

1. **OpenAI API Key**: 
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create an account and navigate to API keys
   - Generate a new API key

2. **Qdrant**:
   - Sign up at [Qdrant Cloud](https://cloud.qdrant.io/)
   - Create a new cluster
   - Get your API key and cluster URL

3. **MongoDB**:
   - Use local MongoDB: `mongodb://localhost:27017`
   - Or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) for cloud hosting

## 🧠 How It Works

### Vector Search & Embeddings

The system uses a sophisticated vector-based semantic search approach:

1. **Text to Embeddings**
   - User queries and knowledge base content are converted to vector embeddings using OpenAI's `text-embedding-3-small` model
   - Each embedding is a 1536-dimensional vector representing semantic meaning

2. **Storage in Qdrant**
   - Embeddings are stored in Qdrant vector database
   - Organized in collections (e.g., `qa_knowledge`, `products`, `services`)
   - Each vector point includes metadata (original text, category, etc.)

3. **Semantic Search**
   - When a user asks a question, it's converted to an embedding
   - Qdrant performs cosine similarity search to find closest matches
   - Most relevant results are retrieved and used to provide context to AI

4. **AI Response Generation**
   - Retrieved context is combined with user query
   - Sent to OpenAI GPT model for intelligent response generation
   - Response is contextually aware and based on your knowledge base

### Simple Workflow Diagram

```
User Query
    ↓
Convert to Embedding (OpenAI)
    ↓
Vector Search (Qdrant)
    ↓
Retrieve Relevant Context
    ↓
Generate AI Response (OpenAI GPT)
    ↓
Send to User (Socket.IO)
```

## 🔄 Complete Chatbot Flow Diagram

### End-to-End System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONVERTSS.COM CHATBOT SYSTEM                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                                    ┌──────────────────┐
│   Web Client     │                                    │   Admin/Owner    │
│  (React/Next.js) │                                    │    Dashboard     │
└────────┬─────────┘                                    └────────┬─────────┘
         │                                                       │
         │ Socket.IO Connection                                 │
         │ (Real-time WebSocket)                                │
         │                                                       │
         └───────────────────┬───────────────────────────────────┘
                             │
                             ▼
         ┌───────────────────────────────────────────────────┐
         │         Socket.IO Server (index.js)               │
         │  • Manages connections (users & owners)           │
         │  • Routes messages between parties                │
         │  • Handles join/leave events                      │
         │  • Broadcasts notifications                       │
         └───────────────┬───────────────────────────────────┘
                         │
         ┌───────────────┴────────────────┐
         │                                │
         ▼                                ▼
┌─────────────────┐            ┌──────────────────────┐
│  User Message   │            │  Owner/Admin Message │
└────────┬────────┘            └──────────┬───────────┘
         │                                │
         │                                │
         ▼                                ▼
┌─────────────────────────────────────────────────────────┐
│           AI Chat Handler (aiChatHandler.js)            │
│  • Checks AI state (enabled/disabled per user)          │
│  • Routes to AI or human handler                        │
│  • Manages conversation context                         │
│  • Stores messages in MongoDB                           │
└────────┬────────────────────────────────────────────────┘
         │
         │ If AI is enabled
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│         AI Response Generator (aiResponse.js)           │
│  Step 1: Analyze user query                             │
│  Step 2: Search knowledge base for context              │
│  Step 3: Generate AI response with context              │
└────────┬────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼                                 ▼
┌──────────────────────┐        ┌────────────────────────┐
│  Knowledge Manager   │        │   Direct AI Response   │
│ (knowledgeManager.js)│        │   (No context needed)  │
└──────────┬───────────┘        └────────────────────────┘
           │
           │ Search for relevant context
           │
           ▼
┌─────────────────────────────────────────────────────────┐
│        Step A: Generate Query Embedding                 │
│                (getEmbeddings.js)                        │
│  ┌────────────────────────────────────────┐             │
│  │  User Query → OpenAI API               │             │
│  │  Model: text-embedding-3-small         │             │
│  │  Output: 1536-dimensional vector       │             │
│  └────────────────────────────────────────┘             │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│      Step B: Vector Similarity Search                   │
│              (storeVecDb.js)                             │
│  ┌────────────────────────────────────────┐             │
│  │  Query Qdrant Collections:             │             │
│  │  • qa_knowledge (Q&A pairs)            │             │
│  │  • products (Product info)             │             │
│  │  • services (Service descriptions)     │             │
│  │  • resources (Scraped content)         │             │
│  │                                        │             │
│  │  Cosine Similarity Search              │             │
│  │  Returns: Top 5 most relevant results  │             │
│  └────────────────────────────────────────┘             │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│     Step C: Context-Aware Response Generation           │
│  ┌────────────────────────────────────────┐             │
│  │  Combine:                              │             │
│  │  • User query                          │             │
│  │  • Retrieved context from Qdrant       │             │
│  │  • System prompt/instructions          │             │
│  │  • Conversation history                │             │
│  │                                        │             │
│  │  Send to: OpenAI GPT API               │             │
│  │  Model: gpt-4 or gpt-3.5-turbo         │             │
│  │  Output: Intelligent, context-aware    │             │
│  │          response                      │             │
│  └────────────────────────────────────────┘             │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│          Step D: Store & Send Response                  │
│  • Save to MongoDB (chats collection)                   │
│  • Emit via Socket.IO to user                           │
│  • Notify admin/owner if connected                      │
└─────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════
            KNOWLEDGE BASE SETUP FLOW
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────┐
│              DATA INPUT SOURCES                         │
└────────┬────────────────────────────────────────────────┘
         │
    ┌────┴────┬──────────┬──────────┬─────────┐
    │         │          │          │         │
    ▼         ▼          ▼          ▼         ▼
┌───────┐ ┌──────┐ ┌─────────┐ ┌──────┐ ┌────────┐
│Manual │ │ PDF  │ │ Website │ │ API  │ │  JSON  │
│ Q&A   │ │Upload│ │Scraping │ │ Data │ │ Import │
└───┬───┘ └───┬──┘ └────┬────┘ └───┬──┘ └────┬───┘
    │         │         │          │         │
    └─────────┴────┬────┴──────────┴─────────┘
                   │
                   ▼
         ┌──────────────────────┐
         │  Text Extraction &   │
         │     Processing       │
         │  • PDF → Text        │
         │  • HTML → Text       │
         │  • Clean & Format    │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Generate Embeddings │
         │   (OpenAI API)       │
         │  text-embedding-     │
         │    3-small           │
         └──────────┬───────────┘
                    │
         ┌──────────┴───────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌────────────────┐
│    MongoDB      │    │    Qdrant      │
│  (Metadata &    │    │  (Vector DB)   │
│   Original Text)│    │  • Embeddings  │
│                 │    │  • Fast Search │
│  Collections:   │    │                │
│  • qa_items     │    │  Collections:  │
│  • products     │    │  • qa_knowledge│
│  • services     │    │  • products    │
│  • resources    │    │  • services    │
└─────────────────┘    └────────────────┘


═══════════════════════════════════════════════════════════
         REAL-TIME COMMUNICATION FLOW
═══════════════════════════════════════════════════════════

User Actions:
─────────────
1. User connects → Socket.IO 'join-as-user' event
2. Load chat history from MongoDB
3. Display previous conversation
4. User sends message → 'user-message' event

   ▼
┌────────────────────────────────────────┐
│  Check AI State in MongoDB             │
│  • Is AI enabled for this user?        │
│  • Has owner taken over?               │
└─────┬──────────────────────────────────┘
      │
      ├─── AI Enabled ───────┐
      │                      │
      │                      ▼
      │            ┌──────────────────┐
      │            │  Generate AI     │
      │            │  Response        │
      │            │  (Full flow above)│
      │            └────────┬─────────┘
      │                     │
      │                     ▼
      │            ┌──────────────────┐
      │            │  Send to User    │
      │            │  Notify Owner    │
      │            └──────────────────┘
      │
      └─── AI Disabled ─────┐
                            │
                            ▼
                   ┌──────────────────┐
                   │  Queue message   │
                   │  Wait for Owner  │
                   │  Notify Owner    │
                   └──────────────────┘

Owner/Admin Actions:
────────────────────
1. Owner connects → 'join-as-owner' event
2. See all active conversations
3. Owner sends message → 'owner-message' event
4. AI automatically disabled for that conversation
5. Human takeover mode activated

   ▼
┌────────────────────────────────────────┐
│  Update AI State                       │
│  • Set AI disabled for user            │
│  • Route messages to owner             │
│  • Bypass AI response generation       │
└────────────────────────────────────────┘


═══════════════════════════════════════════════════════════
              DATA PERSISTENCE LAYER
═══════════════════════════════════════════════════════════

MongoDB Collections:
────────────────────
┌─────────────────────────────────────────────┐
│  chats                                      │
│  • _id, userId, ownerId                     │
│  • messages: [{sender, text, timestamp}]    │
│  • metadata: {email, name, source}          │
│  • createdAt, updatedAt                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  ai_chat_state                              │
│  • userId                                   │
│  • aiEnabled: boolean                       │
│  • lastOwnerMessage: timestamp              │
│  • conversationContext                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  qa_items / products / services             │
│  • _id, question, answer                    │
│  • category, tags                           │
│  • embedding_id (ref to Qdrant)             │
│  • createdAt, updatedAt                     │
└─────────────────────────────────────────────┘

Qdrant Collections:
───────────────────
┌─────────────────────────────────────────────┐
│  qa_knowledge                               │
│  • Vector: [1536 dimensions]                │
│  • Payload: {text, question, answer, id}    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  products / services                        │
│  • Vector: [1536 dimensions]                │
│  • Payload: {name, description, price, etc} │
└─────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════
           KEY TECHNICAL DECISIONS
═══════════════════════════════════════════════════════════

1. Why Socket.IO?
   ✓ Real-time bidirectional communication
   ✓ Automatic reconnection
   ✓ Room-based messaging (user-specific channels)
   ✓ Fallback to long-polling if WebSocket unavailable

2. Why Qdrant for Vectors?
   ✓ Fast similarity search (HNSW algorithm)
   ✓ Scales to millions of vectors
   ✓ Rich filtering capabilities
   ✓ Cloud-hosted option available

3. Why OpenAI Embeddings?
   ✓ State-of-the-art semantic understanding
   ✓ 1536 dimensions capture nuanced meaning
   ✓ Pre-trained on vast knowledge
   ✓ Cost-effective (text-embedding-3-small)

4. Why MongoDB?
   ✓ Flexible schema for varied chat data
   ✓ Excellent for document-based storage
   ✓ Easy to query conversation history
   ✓ Scales horizontally

5. Hybrid AI/Human Approach
   ✓ AI handles initial queries (fast response)
   ✓ Human can take over complex cases
   ✓ Seamless handoff between AI and human
   ✓ AI learns from human responses
```

## 📚 Key Components

### 1. AI Chat Handler (`aiChatHandler.js`)
Manages the chat flow and AI state:
- Processes user messages
- Handles admin/owner messages
- Manages AI auto-response state
- Integrates with knowledge base for context

### 2. Knowledge Manager (`knowledgeManager.js`)
Handles knowledge base operations:
- Add/update/delete Q&A pairs
- Manage products and services
- Generate and store embeddings
- Search knowledge base using vector similarity

### 3. Embeddings Generation (`getEmbeddings.js`)
Creates vector embeddings:
- Converts text/JSON to embeddings
- Uses OpenAI's embedding API
- Supports batch processing

### 4. Vector Database (`storeVecDb.js`)
Qdrant operations:
- Store embeddings with metadata
- Perform similarity searches
- Manage collections

### 5. Web Scraping (`scraping.js`)
Extract content from websites:
- Fetch and parse web pages
- Extract relevant text content
- Clean and format data

### 6. PDF Processing (`pdftoText.js`)
Extract text from PDFs:
- Parse PDF documents
- Extract text content
- Support for image-based PDFs (OCR)

## 🔧 Production Deployment with PM2

### Install PM2 Globally

```bash
npm install -g pm2
```

### Create PM2 Ecosystem File

Create `ecosystem.config.js` in the backend directory:

```javascript
module.exports = {
  apps: [{
    name: 'convertss-backend',
    script: './index.js',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js --env production

# View logs
pm2 logs convertss-backend

# Monitor resources
pm2 monit

# List all processes
pm2 list

# Restart application
pm2 restart convertss-backend

# Stop application
pm2 stop convertss-backend

# Delete from PM2
pm2 delete convertss-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### Production Best Practices

1. **Enable clustering** for better performance
2. **Set memory limits** to prevent memory leaks
3. **Configure log rotation**:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

4. **Monitor with PM2 Plus** (optional):
   ```bash
   pm2 link your-secret-key your-public-key
   ```

## 🛠️ Development Setup

### Local Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run start

# Or use nodemon (if configured)
npx nodemon index.js
```

### Environment-Specific Configurations

**Development** (`.env.development`):
```env
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017
MONGO_DB=aichatbot_dev
```

**Production** (`.env.production`):
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=your_production_mongodb_uri
MONGO_DB=aichatbot_prod
```

## 🧪 Testing

### Test Embeddings Generation

```bash
node functions/getEmbeddings.js
```

### Test Vector Database Connection

```bash
node functions/storeVecDb.js
```

### Test AI Response

```bash
node testAiChat.js
```

## 📊 API Endpoints

### REST Endpoints

```
GET  /                          # Health check
POST /api/knowledge/qa          # Add Q&A pair
GET  /api/knowledge/qa          # Get all Q&A
POST /api/knowledge/search      # Search knowledge base
```

### Socket.IO Events

**Client → Server:**
- `join-as-user` - User joins chat
- `join-as-owner` - Owner/admin joins
- `user-message` - User sends message
- `owner-message` - Owner sends message
- `reset-ai` - Reset AI for user

**Server → Client:**
- `new-message` - New message received
- `ai-response` - AI generated response
- `user-joined` - User joined notification
- `chat-history` - Load previous messages

## 🔒 Security Considerations

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use strong JWT secrets** in production
3. **Enable CORS** only for trusted origins
4. **Rate limit** API endpoints
5. **Validate and sanitize** user inputs
6. **Use HTTPS** in production
7. **Keep dependencies updated**: `npm audit fix`

## 📝 Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "prod": "pm2 start ecosystem.config.js --env production",
    "logs": "pm2 logs convertss-backend",
    "stop": "pm2 stop convertss-backend",
    "restart": "pm2 restart convertss-backend",
    "test": "node testAiChat.js"
  }
}
```

## 🐛 Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongod --version

# Start MongoDB service
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Qdrant Connection Issues
- Verify `QDRANT_HOST` and `QDRANT_API_KEY` are correct
- Check Qdrant cloud dashboard for cluster status
- Test connection: `node functions/storeVecDb.js`

### OpenAI API Errors
- Verify API key is valid
- Check API usage limits and billing
- Ensure you have access to the models being used

### PM2 Issues
```bash
# Clear PM2 dumps
pm2 flush

# Reset PM2 God Daemon
pm2 kill
pm2 resurrect
```

## 📈 Performance Optimization

1. **Use connection pooling** for MongoDB
2. **Cache frequent queries** using Redis (optional)
3. **Batch embedding generation** for multiple items
4. **Use PM2 cluster mode** for load balancing
5. **Optimize vector search** with proper Qdrant configuration
6. **Implement rate limiting** to prevent abuse

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

ISC

## 🆘 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team
- Check documentation at [convertss.com](https://convertss.com)

---

**Built with ❤️ using Node.js, OpenAI, Qdrant, and MongoDB**
