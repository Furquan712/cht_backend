# 🤖 Convertss.com


## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [Production Build](#production-build)
- [Integration](#integration)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

---

Here’s the updated version with **real-time form tracking** smoothly added and aligned to Convertss.com’s positioning:

---

## 🎯 Overview — Convertss.com AI Chat Widget

The **Convertss AI Chat Widget** is a fast, lightweight, and fully embeddable chat interface designed to convert website visitors into qualified leads. It connects seamlessly with the Convertss backend to capture conversations, track form activity, and manage leads in real time from a single dashboard.

It provides:

* **Real-time chat messaging** powered by Socket.IO for instant responses
* **AI-powered conversations** trained on your business data to assist users 24/7
* **Pre-chat & in-chat forms** to collect lead details like name, email, phone, and intent
* **Real-time form tracking** to monitor form views, field interactions, drop-offs, and submissions as they happen
* **Centralized lead dashboard** combining chats and form data in one place
* **AI spam detection** to automatically filter fake or low-quality submissions
* **Session persistence** so conversations and form progress continue after refresh
* **Customizable UI** to match your brand’s colors, fonts, and layout
* **Human handoff support** when AI confidence is low or manual help is required
* **Mobile-responsive design** optimized for all screen sizes

Built for teams that want **better visibility, smarter automation, and higher conversion rates**. 🚀


---

## ✨ Features

### Core Features
✅ Real-time bidirectional communication (Socket.IO)  
✅ AI responses with owner-specific knowledge base  
✅ Admin takeover (AI deactivates when admin responds)  
✅ Typing indicators  
✅ Message persistence (localStorage + MongoDB)  
✅ Unread message badges  
✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)  

### Customization
✅ Theme colors (primary, text, backgrounds)  
✅ Font sizes (xs, sm, base, lg, xl)  
✅ Border radius (none, sm, md, lg, xl, full)  
✅ Pre-chat form customization  
✅ Welcome message customization  
✅ Header text customization  

### Developer Features
✅ Environment-based configuration  
✅ Automatic debug display (when `config-display` element exists)  
✅ Public API for programmatic control  
✅ Build optimization with minification  
✅ Single-line integration  

---

## 📁 Project Structure

```
client/
├── dist/                          # Build output
│   ├── cnvrtss.bundle.js         # Development build (readable)
│   └── cnvrtss.bundle.min.js     # Production build (minified)
│
├── script.js                      # Main widget source code
├── build.js                       # Build script with minification
├── deploy.js                      # Deployment script (optional)
├── setup.sh                       # Setup automation script
│
├── .env.development              # Development environment config
├── .env.production               # Production environment config
│
├── test.html                     # Local testing page
├── package.json                  # Dependencies & scripts
└── README.md                     # This file
```

### Key Files Explained

#### `script.js`
The main source code for the chat widget. Contains:
- UI rendering and styling
- Socket.IO client setup
- Message handling logic
- Pre-chat form management
- Theme customization logic
- Debug configuration display
- Public API exposure

#### `build.js`
Build script that:
- Reads environment variables from `.env.development` or `.env.production`
- Creates both development and minified production bundles
- Outputs to `dist/` folder
- Shows size comparison and savings

#### `test.html`
Local testing page with:
- Widget integration example
- Debug configuration display
- Test controls (open, close, send, clear)
- Feature showcase

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Backend server running (default: `http://localhost:3001`)

### Installation Steps

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment files:**

**Development (`.env.development`):**
```env
API_BASE_URL=http://localhost:3001
SOCKET_URL=http://localhost:3001
WIDGET_VERSION=1.0.0-dev
```

**Production (`.env.production`):**
```env
API_BASE_URL=https://api.yourdomain.com
SOCKET_URL=https://api.yourdomain.com
WIDGET_VERSION=1.0.0
```

3. **Initial build:**
```bash
npm run build
```

---

## 💻 Development

### Build Commands

```bash
# Development build (uses .env.development)
npm run dev:build

# Watch mode (auto-rebuild on changes)
npm run dev:build -- --watch

# Production build (uses .env.production)
npm run build

# Deploy to production (custom deployment)
npm run deploy
```

### Local Testing

1. **Start your backend server:**
```bash
cd ../backend
npm start
```

2. **Build the widget:**
```bash
npm run dev:build
```

3. **Open test page:**
```bash
open test.html
# Or simply open test.html in your browser
```

4. **Check the debug output:**
The test page automatically displays:
- Socket URL
- Owner ID
- User ID
- Socket connection status
- Widget status

### Development Workflow

1. Make changes to `script.js`
2. Run `npm run dev:build` (or use watch mode)
3. Refresh `test.html` in browser
4. Check browser console for logs (prefixed with `[chat widget]`)
5. Use debug display on test page to verify configuration

---

## 🏗️ Production Build

### Building for Production

```bash
npm run build
```

This creates:
- `dist/cnvrtss.bundle.js` - Development version (30KB, readable)
- `dist/cnvrtss.bundle.min.js` - Production version (16KB, minified ~47% smaller)

### Output Example
```
✅ Loaded environment from .env.production

🔧 Build Configuration (production):
   API_BASE_URL: https://api.yourdomain.com
   SOCKET_URL: https://api.yourdomain.com
   WIDGET_VERSION: 1.0.0

🔨 Building widget...
✅ Development build: dist/cnvrtss.bundle.js
✅ Production build (minified): dist/cnvrtss.bundle.min.js

📊 Size comparison:
   Original: 30.80 KB
   Minified: 16.32 KB
   Savings: 47.0%

✨ Build completed successfully!
```

### Deployment

1. **Upload to CDN:**
```bash
# Upload dist/cnvrtss.bundle.min.js to your CDN
aws s3 cp dist/cnvrtss.bundle.min.js s3://your-bucket/widgets/
# or use your preferred CDN
```

2. **Update production URLs** in `.env.production`

3. **Rebuild and redeploy**

---

## 🔌 Integration

### Basic Integration (Production)

Add this single line to your website before the closing `</body>` tag:

```html
<script src="https://cdn.yourdomain.com/cnvrtss.bundle.min.js?cid=YOUR_OWNER_ID"></script>
```

**That's it!** The widget will automatically:
- Load with your owner ID from the `cid` parameter
- Fetch your custom settings from the backend
- Apply your theme colors and customizations
- Connect to the Socket.IO server

### Advanced Integration (Custom Configuration)

For more control, you can set configuration before loading the widget:

```html
<script>
  window.ChatbotConfig = {
    socketUrl: 'https://api.yourdomain.com',
    ownerId: '695c3ef7d03b804a5e6d721e'
  };
</script>
<script src="https://cdn.yourdomain.com/cnvrtss.bundle.min.js"></script>
```

### Local Development Integration

```html
<script>
  window.ChatbotConfig = {
    socketUrl: 'http://localhost:3001',
    ownerId: '695c3ef7d03b804a5e6d721e'
  };
</script>
<script src="./dist/cnvrtss.bundle.min.js"></script>
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `API_BASE_URL` | Backend API base URL | `https://api.yourdomain.com` |
| `SOCKET_URL` | Socket.IO server URL | `https://api.yourdomain.com` |
| `WIDGET_VERSION` | Widget version number | `1.0.0` |

### ChatbotConfig Options

Configure the widget by setting `window.ChatbotConfig` before loading the script:

```javascript
window.ChatbotConfig = {
  // Required
  ownerId: 'your-owner-id',          // Your unique owner ID
  
  // Optional
  socketUrl: 'http://localhost:3001', // Socket.IO server URL
  apiBase: 'http://localhost:3001',   // API base URL (for settings)
  apiUrl: null,                       // Custom API endpoint (overrides socket)
  apiKey: null,                       // API key for authentication
  fetchOptions: {},                   // Additional fetch options
  buildPayload: null                  // Custom payload builder function
};
```

### Theme Customization

Themes are configured via the backend API (`/api/chatui/settings`). Settings include:

- `themeColorHex` - Primary theme color (hex)
- `themeTextColorHex` - Text color on primary background
- `chatBgColor` - Chat panel background (Tailwind class)
- `botBubbleColor` - Bot message bubble color (Tailwind class)
- `userBubbleColor` - User message bubble color (Tailwind class)
- `iconBgColor` - Chat button background (Tailwind class)
- `fontSize` - Text size (xs, sm, base, lg, xl)
- `borderRadius` - Corner roundness (none, sm, md, lg, xl, full)
- `headerName` - Chat header title
- `headerMessage` - Chat header subtitle
- `bubbleText` - Welcome message
- `showPreChatForm` - Show/hide pre-chat form
- `preChatHeading` - Pre-chat form button text
- Field visibility and requirements (name, email, phone)

---

## 📚 API Reference

### AIOFC_Chat API

The widget exposes a global `AIOFC_Chat` object with the following methods:

```javascript
// Open the chat panel
AIOFC_Chat.open();

// Close the chat panel
AIOFC_Chat.close();

// Send a message programmatically
AIOFC_Chat.send('Hello from JavaScript!');

// Clear conversation history
AIOFC_Chat.clear();

// Get current widget status
const status = AIOFC_Chat.getStatus();
// Returns: {
//   socketUrl: 'http://localhost:3001',
//   ownerId: '695c3ef7d03b804a5e6d721e',
//   userId: 'u_abc123',
//   socketConnected: true,
//   open: false
// }
```

### Debug Display

The widget automatically updates an element with `id="config-display"` if present:

```html
<pre id="config-display"></pre>
```

This displays:
```json
{
  "socketUrl": "http://localhost:3001",
  "ownerId": "695c3ef7d03b804a5e6d721e",
  "userId": "u_abc123",
  "socketConnected": true,
  "widgetStatus": "Closed"
}
```

Updates automatically when:
- Socket connects/disconnects
- Widget loads
- Panel opens/closes

---

## 🐛 Troubleshooting

### "Echo" Responses Instead of AI

**Symptoms:** Messages are echoed back like "Echo: hello"

**Causes:**
1. Socket.IO connection failed
2. Backend server not running
3. CORS issues
4. Wrong Socket URL

**Solutions:**
1. Check browser console for connection errors
2. Verify backend is running: `lsof -ti:3001`
3. Check `socketConnected` in debug display
4. Ensure `ChatbotConfig.socketUrl` matches your backend

### Widget Not Loading

**Symptoms:** Chat button doesn't appear

**Causes:**
1. Script path incorrect
2. JavaScript errors
3. Bundle not built

**Solutions:**
1. Check browser console for errors
2. Verify file exists: `ls -la dist/cnvrtss.bundle.min.js`
3. Rebuild: `npm run build`
4. Check network tab for 404 errors

### Socket Connection Failed

**Symptoms:** Debug shows `socketConnected: false`

**Causes:**
1. Backend not running
2. CORS not configured
3. Port mismatch
4. Firewall blocking connection

**Solutions:**
1. Start backend: `cd ../backend && npm start`
2. Check backend CORS settings
3. Verify Socket URL matches backend port
4. Check firewall/network settings

### Styles Not Applied

**Symptoms:** Widget appears unstyled or broken

**Causes:**
1. Settings API not responding
2. Invalid theme colors
3. Owner ID not found

**Solutions:**
1. Check settings endpoint: `/api/chatui/settings?ownerId=YOUR_ID`
2. Verify owner ID is correct
3. Check backend logs for errors
4. Test with default settings (no owner ID)

### Messages Not Saving

**Symptoms:** Conversation disappears on refresh

**Causes:**
1. localStorage disabled
2. Private browsing mode
3. Storage quota exceeded

**Solutions:**
1. Enable localStorage in browser
2. Use normal browsing mode
3. Clear old localStorage data
4. Check browser storage settings

---

## 📞 Support & Contributing

### Getting Help

1. Check browser console for errors
2. Review backend logs
3. Use debug display on test page
4. Check Socket.IO connection status

### Console Logging

The widget logs helpful debug information with the `[chat widget]` prefix:

```
[chat widget] parsed adminId: 695c3ef7d03b804a5e6d721e
[chat widget] fetching settings from http://localhost:3001/api/chatui/settings?ownerId=...
[chat widget] ✅ connected to socket abc123 userId u_xyz789 ownerId 695c3ef7d03b804a5e6d721e
[chat widget] 🔄 Syncing saved metadata on connect: {...}
```

---

## 📄 License

Private/Proprietary - AIOFC Project

---

## 🔄 Version History

- **v1.0.0** - Initial production release
  - Socket.IO integration
  - AI response handling
  - Theme customization
  - Pre-chat forms
  - Debug display
  - Public API
