#!/bin/bash

# Database setup script for Personal Finances application

echo "🚀 Setting up Personal Finances database..."

# Check if DATABASE_URL is set
if [[ -z "{$DATABASE_URL}" ]]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set it in your .env file or export it:"
    echo "export DATABASE_URL=postgresql://username:password@192.168.1.41:5432/personal_finances"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Generating database migrations..."
npm run db:generate

echo "🔧 Running database migrations..."
npm run db:migrate

echo "✅ Database setup completed successfully!"
echo ""
echo "You can now start the application with:"
echo "npm run dev"
echo ""
echo "To view your database with Drizzle Studio:"
echo "npm run db:studio" 