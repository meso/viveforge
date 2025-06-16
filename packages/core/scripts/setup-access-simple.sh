#!/bin/bash

# Cloudflare Access 簡易設定スクリプト
# 
# このスクリプトは環境変数とwranglerコマンドを使って
# 最小限のCloudflare Access設定を行います

set -e

echo "🚀 Cloudflare Access 簡易設定を開始します..."

# 設定値
DOMAIN="vibebase.mesongo.workers.dev"
ACCOUNT_ID="c84ee758532a3352dc13df8b565ebb68"

# 色付きメッセージ
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ステップ1: GitHub OAuth App の設定確認
print_step "Step 1: GitHub OAuth App の設定確認"
echo ""
echo "GitHub Developer Settings でOAuth Appを作成してください:"
echo "URL: https://github.com/settings/developers"
echo ""
echo "設定項目:"
echo "- Application name: Vibebase"
echo "- Homepage URL: https://$DOMAIN"
echo "- Authorization callback URL: https://[your-team].cloudflareaccess.com/cdn-cgi/access/callback"
echo ""

read -p "GitHub Client ID を入力してください: " GITHUB_CLIENT_ID
read -s -p "GitHub Client Secret を入力してください: " GITHUB_CLIENT_SECRET
echo ""

if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    print_error "GitHub OAuth の設定が不完全です"
    exit 1
fi

print_success "GitHub OAuth 設定を確認しました"

# ステップ2: Cloudflare API Token の確認
print_step "Step 2: Cloudflare API Token の確認"

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo ""
    echo "API Token が必要です。以下で作成してください:"
    echo "https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    echo "権限設定:"
    echo "- Zone:Zone Settings:Edit"
    echo "- Zone:Zone:Read" 
    echo "- Account:Access: Apps and Policies:Edit"
    echo "- Account:Cloudflare Tunnel:Edit"
    echo ""
    read -s -p "Cloudflare API Token を入力してください: " CLOUDFLARE_API_TOKEN
    echo ""
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        print_error "API Token が設定されていません"
        exit 1
    fi
fi

print_success "API Token を確認しました"

# ステップ3: Zero Trust の初期化確認
print_step "Step 3: Zero Trust の確認"

echo ""
print_warning "Zero Trust ダッシュボードで初期設定を完了してください:"
echo "https://one.dash.cloudflare.com/"
echo ""
read -p "Zero Trust の初期設定完了後、Enterを押してください..."

print_success "Zero Trust の初期化を確認しました"

# ステップ4: 設定ファイルの生成
print_step "Step 4: 設定ファイルの生成"

# Cloudflare Access 設定用の一時的なJSONファイルを作成
cat > cloudflare-access-config.json << EOF
{
  "github_client_id": "$GITHUB_CLIENT_ID",
  "github_client_secret": "$GITHUB_CLIENT_SECRET",
  "domain": "$DOMAIN",
  "account_id": "$ACCOUNT_ID"
}
EOF

print_success "設定ファイルを生成しました"

# ステップ5: 手動設定ガイド
print_step "Step 5: 手動設定が必要です"

echo ""
print_warning "以下の設定を Cloudflare ダッシュボードで手動で行ってください:"
echo ""
echo "1. Zero Trust → Settings → Authentication → Login methods"
echo "   - 'Add new' → 'GitHub'"
echo "   - App ID: $GITHUB_CLIENT_ID"
echo "   - Client secret: $GITHUB_CLIENT_SECRET"
echo ""
echo "2. Zero Trust → Access → Applications"
echo "   - 'Add an application' → 'Self-hosted'"
echo "   - Application name: Vibebase Dashboard"
echo "   - Session Duration: 24 hours"
echo "   - Application domain: $DOMAIN"
echo ""
echo "3. Access Policy:"
echo "   - Action: Allow"
echo "   - Include: Everyone (with GitHub IdP)"
echo ""

# ステップ6: 設定確認
print_step "Step 6: 設定確認"

echo ""
read -p "上記の設定完了後、Enterを押してください..."

echo ""
print_success "Cloudflare Access の設定が完了しました!"
echo ""
echo "🌐 テスト用URL: https://$DOMAIN"
echo "📝 設定ファイル: cloudflare-access-config.json"
echo ""
print_warning "注意: cloudflare-access-config.json にはシークレットが含まれているため、"
print_warning "      設定完了後は安全に削除してください。"

# クリーンアップ
read -p "設定ファイルを削除しますか? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f cloudflare-access-config.json
    print_success "設定ファイルを削除しました"
fi

echo ""
echo "🎉 セットアップ完了!"
echo "Vibebase にアクセスして GitHub 認証をテストしてください。"