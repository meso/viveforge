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
    sed -i.bak "s/REPLACE_WITH_ACTUAL_DATABASE_ID/$DB_ID/" wrangler.toml
    rm -f wrangler.toml.bak
    
    echo "✅ Database created with ID: $DB_ID"
else
    echo "⚠️ Database might already exist, continuing..."
fi

echo "🔧 Running database migrations..."
# Run all migrations in order
for migration_file in migrations/*.sql; do
    if [ -f "$migration_file" ]; then
        echo "  Running $(basename "$migration_file")..."
        wrangler d1 execute viveforge-db --file="$migration_file" --remote
    fi
done

echo "☁️ Creating R2 buckets..."
# Check if R2 is enabled by trying to list buckets
R2_CHECK=$(wrangler r2 bucket list 2>&1)
if echo "$R2_CHECK" | grep -q "must purchase R2"; then
    echo "  ⚠️ R2 is not enabled in your Cloudflare account."
    echo "  📋 To enable R2:"
    echo "     1. Go to https://dash.cloudflare.com/[account-id]/r2"
    echo "     2. Click 'Purchase R2' and enable it (Free tier available)"
    echo "     3. Re-run this setup script"
    echo "  ⏭️ Skipping R2 bucket creation for now..."
    echo ""
    echo "  ℹ️ Note: Viveforge will work without R2, but some features will be disabled:"
    echo "     - Schema snapshots storage"
    echo "     - File upload functionality"
    R2_ENABLED=false
else
    # Create R2 buckets for storage
    echo "  Creating viveforge-system bucket..."
    wrangler r2 bucket create viveforge-system 2>/dev/null || echo "    Bucket might already exist, continuing..."

    echo "  Creating viveforge-storage bucket..."
    wrangler r2 bucket create viveforge-storage 2>/dev/null || echo "    Bucket might already exist, continuing..."
    R2_ENABLED=true
fi

echo "🗂️ Creating KV namespace for sessions..."
KV_OUTPUT=$(wrangler kv:namespace create "SESSIONS" 2>/dev/null)
if [ $? -eq 0 ]; then
    # Extract KV namespace ID from output
    KV_ID=$(echo "$KV_OUTPUT" | grep "id" | sed 's/.*id = "\([^"]*\)".*/\1/')
    
    # Update wrangler.toml with the new KV namespace ID
    if [ ! -z "$KV_ID" ]; then
        # Update KV namespace configuration
        sed -i.bak "s/REPLACE_WITH_ACTUAL_KV_ID/$KV_ID/" wrangler.toml
        rm -f wrangler.toml.bak
        echo "  ✅ KV namespace created with ID: $KV_ID"
    fi
else
    echo "  ⚠️ KV namespace might already exist, continuing..."
fi

echo "🏗️ Building dashboard..."
cd ../dashboard
npm install
npm run build

echo "🚀 Deploying to Cloudflare..."
cd ../core

# Update wrangler.toml to comment out R2 bindings if R2 is not enabled
if [ "$R2_ENABLED" = false ]; then
    echo "  Disabling R2 bindings in wrangler.toml..."
    sed -i.bak '/\[\[r2_buckets\]\]/,/bucket_name = "viveforge-/ {
        s/^/# /
    }' wrangler.toml
    rm -f wrangler.toml.bak
fi

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