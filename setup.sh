#!/bin/bash

# AIOFC Chat Widget - Quick Setup Script

echo "🚀 AIOFC Chat Widget Setup"
echo "=========================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js $(node --version) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.development .env
    echo "✅ .env file created from .env.development"
    echo "⚠️  Please update .env with your configuration"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "📖 Next steps:"
echo "   1. Update .env with your API URLs"
echo "   2. Run 'npm run dev:build' for development"
echo "   3. Run 'npm run build' for production"
echo ""
echo "📚 See README.md for full documentation"
