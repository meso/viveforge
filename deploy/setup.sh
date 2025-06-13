#!/bin/bash

echo "🚀 Setting up Viveforge on Cloudflare..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "🔐 Please login to Cloudflare first:"
    echo "wrangler login"
    exit 1
fi

echo "📦 Installing dependencies..."
cd packages/core
npm install

echo "🗄️ Creating D1 database..."
DB_OUTPUT=$(wrangler d1 create viveforge-db 2>/dev/null)
if [ $? -eq 0 ]; then
    # Extract database ID from output
    DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\([^"]*\)".*/\1/')
    
    # Update wrangler.toml with the new database ID
    sed -i.bak "s/database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
    rm wrangler.toml.bak
    
    echo "✅ Database created with ID: $DB_ID"
else
    echo "⚠️ Database might already exist, continuing..."
fi

echo "🔧 Running database migrations..."
wrangler d1 execute viveforge-db --file=migrations/0001_initial.sql --remote

echo "🏗️ Building dashboard..."
cd ../dashboard
npm install
npm run build

echo "🚀 Deploying to Cloudflare..."
cd ../core
wrangler deploy

echo ""
echo "🎉 Viveforge has been successfully deployed!"
echo ""
echo "Your Viveforge instance is now available at:"
DEPLOY_URL=$(wrangler deployments list --limit 1 2>/dev/null | grep "https://" | awk '{print $2}' | head -1)
if [ ! -z "$DEPLOY_URL" ]; then
    echo "$DEPLOY_URL"
else
    echo "https://yourworker.yourdomain.workers.dev"
fi
echo ""
echo "📖 API Documentation:"
echo "  Health Check: [YOUR_URL]/api/health"
echo "  Items API: [YOUR_URL]/api/items"
echo "  Projects API: [YOUR_URL]/api/projects"
echo ""
echo "🔧 To customize your instance, edit the files in packages/core/src/"
echo "💡 Run 'wrangler dev' in packages/core/ for local development"