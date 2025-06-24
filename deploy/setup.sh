#!/bin/bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Setting up Vibebase on Cloudflare...${NC}"
echo ""

# Function to generate random string
generate_random_string() {
    local length=${1:-8}
    openssl rand -hex $length | cut -c1-$length
}

# Function to generate VAPID keys using Node.js
generate_vapid_keys() {
    echo -e "${BLUE}🔐 Generating VAPID keys...${NC}"
    
    # Create a temporary Node.js script to generate VAPID keys
    cat > /tmp/generate_vapid.js << 'EOF'
const crypto = require('crypto');

// Generate VAPID key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: {
        type: 'spki',
        format: 'der'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
    }
});

// Convert to base64url format (VAPID format)
const publicKeyBase64 = publicKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const privateKeyBase64 = privateKey.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

console.log(`VAPID_PUBLIC_KEY=${publicKeyBase64}`);
console.log(`VAPID_PRIVATE_KEY=${privateKeyBase64}`);
EOF

    # Generate keys and extract them
    local vapid_output=$(node /tmp/generate_vapid.js)
    export VAPID_PUBLIC_KEY=$(echo "$vapid_output" | grep VAPID_PUBLIC_KEY | cut -d'=' -f2)
    export VAPID_PRIVATE_KEY=$(echo "$vapid_output" | grep VAPID_PRIVATE_KEY | cut -d'=' -f2)
    
    # Clean up
    rm -f /tmp/generate_vapid.js
    
    echo -e "${GREEN}  ✅ VAPID keys generated${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it first:${NC}"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}🔐 Please login to Cloudflare first:${NC}"
    echo "wrangler login"
    exit 1
fi

# Get account information
echo -e "${BLUE}📋 Getting account information...${NC}"
ACCOUNT_INFO=$(wrangler whoami)
ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | grep -A 10 "Account Name" | tail -n +3 | head -n 1 | awk '{print $4}' | tr -d '│')

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}❌ Could not determine account ID. Please make sure you're logged in.${NC}"
    exit 1
fi

echo -e "${GREEN}  ✅ Account ID: $ACCOUNT_ID${NC}"

# Get worker name from user or generate one
if [ -z "$WORKER_NAME" ]; then
    echo ""
    echo -e "${YELLOW}🏷️  What would you like to name your Vibebase instance?${NC}"
    read -p "Worker name (default: vibebase-$(generate_random_string 4)): " INPUT_WORKER_NAME
    WORKER_NAME=${INPUT_WORKER_NAME:-"vibebase-$(generate_random_string 4)"}
fi

# Generate deployment domain
DEPLOYMENT_DOMAIN="${WORKER_NAME}.${ACCOUNT_ID}.workers.dev"

echo -e "${GREEN}  ✅ Worker name: $WORKER_NAME${NC}"
echo -e "${GREEN}  ✅ Deployment domain: $DEPLOYMENT_DOMAIN${NC}"

# Set VAPID subject email
VAPID_SUBJECT="mailto:${WORKER_NAME}@vibebase.app"

echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"

# Navigate to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Install dependencies using pnpm
if command -v pnpm &> /dev/null; then
    echo -e "${BLUE}  Using pnpm...${NC}"
    pnpm install
else
    echo -e "${BLUE}  Using npm...${NC}"
    npm install
fi

echo ""
echo -e "${BLUE}🗄️  Creating D1 database...${NC}"
cd packages/core

# Create D1 database
DB_OUTPUT=$(wrangler d1 create vibebase-db --json 2>/dev/null || echo '{"error": true}')
if echo "$DB_OUTPUT" | grep -q '"error"'; then
    echo -e "${YELLOW}  ⚠️  Database might already exist, trying to list existing databases...${NC}"
    # Try to find existing database
    EXISTING_DB=$(wrangler d1 list --json 2>/dev/null | jq -r '.[] | select(.name=="vibebase-db") | .uuid' | head -n1)
    if [ ! -z "$EXISTING_DB" ] && [ "$EXISTING_DB" != "null" ]; then
        DATABASE_ID="$EXISTING_DB"
        echo -e "${GREEN}  ✅ Using existing database: $DATABASE_ID${NC}"
    else
        echo -e "${RED}❌ Could not create or find database. Please check your permissions.${NC}"
        exit 1
    fi
else
    DATABASE_ID=$(echo "$DB_OUTPUT" | jq -r '.uuid')
    echo -e "${GREEN}  ✅ Database created: $DATABASE_ID${NC}"
fi

echo ""
echo -e "${BLUE}🗂️  Creating KV namespace...${NC}"

# Create KV namespace
KV_OUTPUT=$(wrangler kv:namespace create "SESSIONS" --json 2>/dev/null || echo '{"error": true}')
if echo "$KV_OUTPUT" | grep -q '"error"'; then
    echo -e "${YELLOW}  ⚠️  KV namespace might already exist, trying to list existing namespaces...${NC}"
    # Try to find existing namespace
    EXISTING_KV=$(wrangler kv:namespace list --json 2>/dev/null | jq -r '.[] | select(.title | contains("SESSIONS")) | .id' | head -n1)
    if [ ! -z "$EXISTING_KV" ] && [ "$EXISTING_KV" != "null" ]; then
        KV_NAMESPACE_ID="$EXISTING_KV"
        echo -e "${GREEN}  ✅ Using existing KV namespace: $KV_NAMESPACE_ID${NC}"
    else
        echo -e "${RED}❌ Could not create or find KV namespace. Please check your permissions.${NC}"
        exit 1
    fi
else
    KV_NAMESPACE_ID=$(echo "$KV_OUTPUT" | jq -r '.id')
    echo -e "${GREEN}  ✅ KV namespace created: $KV_NAMESPACE_ID${NC}"
fi

echo ""
echo -e "${BLUE}☁️  Creating R2 buckets...${NC}"

# Check if R2 is available
R2_CHECK=$(wrangler r2 bucket list 2>&1 || true)
if echo "$R2_CHECK" | grep -q "must purchase R2\|not found\|unauthorized"; then
    echo -e "${YELLOW}  ⚠️  R2 is not enabled in your Cloudflare account.${NC}"
    echo -e "${YELLOW}  📋 To enable R2:${NC}"
    echo -e "${YELLOW}     1. Go to https://dash.cloudflare.com/$ACCOUNT_ID/r2${NC}"
    echo -e "${YELLOW}     2. Click 'Purchase R2' and enable it (Free tier available)${NC}"
    echo -e "${YELLOW}     3. Re-run this setup script${NC}"
    echo -e "${YELLOW}  ⏭️  Skipping R2 bucket creation for now...${NC}"
    echo ""
    echo -e "${YELLOW}  ℹ️  Note: Vibebase will work without R2, but some features will be disabled:${NC}"
    echo -e "${YELLOW}     - Schema snapshots storage${NC}"
    echo -e "${YELLOW}     - File upload functionality${NC}"
    R2_ENABLED=false
else
    # Create R2 buckets
    echo -e "${BLUE}  Creating vibebase-system bucket...${NC}"
    wrangler r2 bucket create vibebase-system 2>/dev/null || echo -e "${YELLOW}    Bucket might already exist, continuing...${NC}"
    
    echo -e "${BLUE}  Creating vibebase-storage bucket...${NC}"
    wrangler r2 bucket create vibebase-storage 2>/dev/null || echo -e "${YELLOW}    Bucket might already exist, continuing...${NC}"
    
    echo -e "${GREEN}  ✅ R2 buckets created/verified${NC}"
    R2_ENABLED=true
fi

# Generate VAPID keys
generate_vapid_keys

echo ""
echo -e "${BLUE}📝 Generating wrangler.toml...${NC}"

# Copy template and replace placeholders
cp ../../deploy/wrangler.template.toml wrangler.toml

# Replace placeholders
sed -i.bak "s/__ACCOUNT_ID__/$ACCOUNT_ID/g" wrangler.toml
sed -i.bak "s/__WORKER_NAME__/$WORKER_NAME/g" wrangler.toml
sed -i.bak "s/__DATABASE_ID__/$DATABASE_ID/g" wrangler.toml
sed -i.bak "s/__KV_NAMESPACE_ID__/$KV_NAMESPACE_ID/g" wrangler.toml
sed -i.bak "s/__DEPLOYMENT_DOMAIN__/$DEPLOYMENT_DOMAIN/g" wrangler.toml
sed -i.bak "s/__VAPID_PUBLIC_KEY__/$VAPID_PUBLIC_KEY/g" wrangler.toml
sed -i.bak "s/__VAPID_SUBJECT__/$VAPID_SUBJECT/g" wrangler.toml

# Clean up backup file
rm -f wrangler.toml.bak

# Comment out R2 bindings if R2 is not enabled
if [ "$R2_ENABLED" = false ]; then
    echo -e "${BLUE}  Disabling R2 bindings...${NC}"
    sed -i.bak '/\[\[r2_buckets\]\]/,/^$/s/^/# /' wrangler.toml
    rm -f wrangler.toml.bak
fi

echo -e "${GREEN}  ✅ wrangler.toml generated${NC}"

echo ""
echo -e "${BLUE}🗄️  Running database migrations...${NC}"

# Check if migrations directory exists
if [ -d "migrations" ]; then
    # Run all migrations in order
    for migration_file in migrations/*.sql; do
        if [ -f "$migration_file" ]; then
            echo -e "${BLUE}  Running $(basename "$migration_file")...${NC}"
            wrangler d1 execute vibebase-db --file="$migration_file" --remote
        fi
    done
    echo -e "${GREEN}  ✅ Database migrations completed${NC}"
else
    echo -e "${YELLOW}  ⚠️  No migrations directory found, skipping...${NC}"
fi

echo ""
echo -e "${BLUE}🏗️  Building dashboard...${NC}"
cd ../dashboard

# Install dashboard dependencies and build
if command -v pnpm &> /dev/null; then
    pnpm install
    pnpm build
else
    npm install
    npm run build
fi

echo -e "${GREEN}  ✅ Dashboard built${NC}"

echo ""
echo -e "${BLUE}🚀 Deploying to Cloudflare...${NC}"
cd ../core

# Deploy to Cloudflare
wrangler deploy

# Store VAPID private key as a secret (if R2 is enabled)
if [ "$R2_ENABLED" = true ]; then
    echo ""
    echo -e "${BLUE}🔐 Setting VAPID private key secret...${NC}"
    echo "$VAPID_PRIVATE_KEY" | wrangler secret put VAPID_PRIVATE_KEY
    echo -e "${GREEN}  ✅ VAPID private key secret set${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  R2 is disabled, VAPID private key not stored as secret.${NC}"
    echo -e "${YELLOW}    Push notifications will not work until R2 is enabled.${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Vibebase has been successfully deployed!${NC}"
echo ""
echo -e "${GREEN}📍 Your Vibebase instance:${NC}"
echo -e "${GREEN}   🌐 URL: https://$DEPLOYMENT_DOMAIN${NC}"
echo -e "${GREEN}   🏷️  Worker: $WORKER_NAME${NC}"
echo -e "${GREEN}   🆔 Account: $ACCOUNT_ID${NC}"
echo ""
echo -e "${GREEN}🔗 Quick Links:${NC}"
echo -e "${GREEN}   📋 Dashboard: https://$DEPLOYMENT_DOMAIN${NC}"
echo -e "${GREEN}   ❤️  Health Check: https://$DEPLOYMENT_DOMAIN/api/health${NC}"
echo -e "${GREEN}   📚 API Docs: https://$DEPLOYMENT_DOMAIN/api/docs${NC}"
echo ""

if [ "$R2_ENABLED" = false ]; then
    echo -e "${YELLOW}⚠️  Important: R2 is not enabled${NC}"
    echo -e "${YELLOW}   Some features are disabled until you enable R2:${NC}"
    echo -e "${YELLOW}   • Schema snapshots${NC}"
    echo -e "${YELLOW}   • File uploads${NC}"
    echo -e "${YELLOW}   • Push notifications${NC}"
    echo -e "${YELLOW}   Enable R2 at: https://dash.cloudflare.com/$ACCOUNT_ID/r2${NC}"
    echo ""
fi

echo -e "${BLUE}🔧 Next Steps:${NC}"
echo -e "${BLUE}   1. Visit your dashboard to set up authentication${NC}"
echo -e "${BLUE}   2. Configure your first database tables${NC}"
echo -e "${BLUE}   3. Start building your app!${NC}"
echo ""
echo -e "${GREEN}🎯 Happy coding with Vibebase!${NC}"