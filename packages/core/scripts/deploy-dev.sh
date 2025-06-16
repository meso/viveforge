#!/bin/bash

# 開発モード用デプロイスクリプト
# 認証を一時的に無効化してVibebaseをテストできます

set -e

echo "🔧 開発モードでデプロイします（認証無効）..."

# 環境変数を設定して認証をスキップ
export VIBEBASE_DEV_MODE=true

# 一時的に認証ミドルウェアを無効化
echo "⏳ 認証を一時的に無効化中..."

# index.tsのバックアップを作成
cp src/index.ts src/index.ts.backup

# 認証ミドルウェアの行をコメントアウト
sed -i.tmp 's|app.use(\x27/api/\*\x27, requireAuth)|// DEVELOPMENT MODE: app.use(\x27/api/\*\x27, requireAuth)|g' src/index.ts

echo "📦 デプロイ中..."
npm run deploy

echo "🔄 認証設定を復元中..."
# バックアップから復元
mv src/index.ts.backup src/index.ts
rm -f src/index.ts.tmp

echo ""
echo "✅ 開発モードでデプロイ完了!"
echo "🌐 URL: https://vibebase.mesongo.workers.dev"
echo ""
echo "⚠️  注意: このデプロイは認証が無効化されています"
echo "   本番使用前に以下のコマンドで本番モードに戻してください:"
echo "   npm run deploy"
echo ""
echo "🔧 Cloudflare Access を設定する場合:"
echo "   ./scripts/setup-access-simple.sh を実行してください"