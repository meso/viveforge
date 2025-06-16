# Vibebase 🎵

> **Personal BaaS for Vibe Coders** - Vibe CoderのためのミニマムなBackend-as-a-Service on Cloudflare

⚠️ **Work in Progress** - このプロジェクトは現在開発中です。基本機能は動作しますが、まだ実験的な段階にあります。本番環境での使用は推奨されません。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/meso/vibebase&authed=true&config=packages/core/wrangler.deploy.toml)

Vibebaseは、Cloudflare上で動作する、AIを活用してコードを書く開発者（Vibe Coders）のためのパーソナルBaaSプラットフォームです。フロントエンドやモバイルアプリ開発が得意な開発者が、バックエンドインフラを簡単に構築・管理できることを目指しています。

## ✨ 特徴

- 🚀 **ワンクリックデプロイ** - GitHubから1クリックでCloudflareアカウントにデプロイ
- 💪 **フルスタックTypeScript** - 型安全性と開発体験の向上
- ☁️ **Cloudflareエコシステム** - Workers、D1、R2などのCloudflareサービスをフル活用
- 🎯 **個人開発者フレンドリー** - 複雑な設定不要で、すぐに使い始められる
- 📱 **モダンなダッシュボード** - Preact + Vite + Tailwind CSSで構築された管理画面

## 🎯 ターゲットユーザー

- AIを活用して効率的にコードを書くVibe Coders
- フロントエンド・モバイルアプリ開発に集中したい開発者
- バックエンドインフラの構築に時間をかけたくない開発者
- Cloudflareのサービスをシンプルに活用したい開発者

## 🚀 クイックスタート

### ワンクリックデプロイ

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/meso/vibebase&authed=true&config=packages/core/wrangler.deploy.toml)

**⚠️ デプロイ前の準備**
1. Cloudflareアカウントを作成
2. **R2ストレージを有効化**（オプション、無料枠あり）
   - [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 Object Storage → Purchase R2

または、以下のコマンドで手動デプロイ：

```bash
# 1. リポジトリをクローン
git clone https://github.com/meso/vibebase.git
cd vibebase

# 2. Wrangler CLIをインストール
npm install -g wrangler

# 3. Cloudflareにログイン
wrangler login

# 4. 自動セットアップを実行
chmod +x deploy/setup.sh
./deploy/setup.sh
```

**📋 R2について**
- R2を有効化しない場合でも基本機能は動作します
- R2なしの場合、以下の機能が制限されます：
  - スキーマスナップショットのファイル保存
  - 将来的なファイルアップロード機能

詳細なデプロイ手順は [DEPLOYMENT.md](./DEPLOYMENT.md) をご覧ください。

## 📋 主要機能

### ✅ 実装済み（v0.1.0 MVP + v0.2.0 一部）

- 🏗️ **管理ダッシュボード** - Webベースの管理画面
- 🗄️ **データベース機能（D1）** - SQLiteベースのデータベース
- 🔧 **基本的なCRUD API** - REST APIの自動生成
- 📦 **ワンクリックデプロイ** - GitHub経由のデプロイ
- 💾 **ストレージ（R2）** - ファイルアップロード・ダウンロード・削除
- 🔍 **検索機能** - インデックス付きカラムでの高速検索
- 🔐 **管理者認証** - GitHub OAuthとJWT認証（[vibebase-auth](https://github.com/vibebase/vibebase-auth)統合）
- 📸 **スキーマスナップショット** - データベーススキーマのバックアップ
- 🔗 **インデックス管理** - データベースインデックスの作成・削除

### 🚧 開発予定

- 👥 **ユーザー認証** - 複数OAuth providers（Google、GitHub等）
- ⚡ **リアルタイム機能** - WebSocket/SSE対応
- 📱 **Push通知** - Web Push/FCM
- 🛠️ **CLIツール** - 開発効率化ツール

## 🏗️ 技術スタック

- **言語**: TypeScript
- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2
- **フロントエンド**: Preact + Vite + Tailwind CSS
- **ビルドツール**: Wrangler, Vite
- **テスト**: Vitest, Miniflare

## 📁 プロジェクト構造

```
vibebase/
├── packages/
│   ├── core/              # コアライブラリ（Hono + Workers）
│   ├── dashboard/         # 管理ダッシュボード（Preact）
│   ├── sdk/              # クライアントSDK（予定）
│   └── cli/              # CLIツール（予定）
├── examples/             # サンプルアプリケーション
├── docs/                 # ドキュメント
├── deploy/              # デプロイメント設定
├── DEPLOYMENT.md        # デプロイ手順
└── README.md           # このファイル
```

## 🔧 ローカル開発

```bash
# 依存関係をインストール
pnpm install

# 開発サーバーを起動（API）
cd packages/core
pnpm dev

# 別のターミナルでダッシュボード開発サーバー
cd packages/dashboard
pnpm dev
```

## 📖 API使用例

### ヘルスチェック
```bash
curl https://your-worker.your-subdomain.workers.dev/api/health
```

### アイテム管理
```bash
# アイテム作成
curl -X POST https://your-worker.your-subdomain.workers.dev/api/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Item", "description": "A test item"}'

# アイテム一覧
curl https://your-worker.your-subdomain.workers.dev/api/items
```

詳細なAPI仕様は [DEPLOYMENT.md](./DEPLOYMENT.md) をご覧ください。

## 🗺️ ロードマップ

### Phase 1: MVP (v0.1.0) ✅ 完了
- [x] 基本的な管理ダッシュボード
- [x] D1データベース統合
- [x] 基本的なCRUD API
- [x] GitHub経由のデプロイ

### 追加実装済み機能
- [x] 検索機能（インデックス付きカラムでの高速検索）
- [x] スキーマスナップショット機能
- [x] インデックス管理機能
- [x] 包括的なテストスイート

### Phase 2: 認証とストレージ (v0.2.0) 🚧 進行中
- [x] **管理者認証実装**（[vibebase-auth](https://github.com/vibebase/vibebase-auth)統合）
  - [x] GitHub OAuth認証
  - [x] JWTトークン検証とセキュリティ
  - [x] 自動トークンリフレッシュ
  - [x] 認証ミドルウェアとルート保護
- [ ] **ユーザー認証実装**（アプリ利用者向け）
  - [ ] 複数OAuthプロバイダー対応
  - [ ] ユーザー管理API
  - [ ] 権限・ロール管理
- [x] R2ストレージ統合
- [x] ファイルアップロードAPI

### Phase 3: リアルタイム機能 (v0.3.0)
- [ ] リアルタイムDB機能
- [ ] Push通知実装
- [ ] WebSocket/SSE対応

### Phase 4: 開発体験向上 (v0.4.0)
- [ ] CLIツール
- [ ] 各種フレームワーク用SDK
- [ ] 開発/本番環境の分離

## 🤝 コントリビューション

プロジェクトへの貢献を歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

Elastic License 2.0 - 詳細は [LICENSE](LICENSE) ファイルをご覧ください。

**要約**:
- ✅ 個人・商用利用可能（自分のアプリのバックエンドとして）
- ✅ 修正・再配布可能
- ❌ SaaS/PaaSとして第三者に提供することは禁止

## 💬 サポート

- 🐛 **バグ報告**: [Issues](https://github.com/meso/vibebase/issues)
- 💡 **機能要望**: [Issues](https://github.com/meso/vibebase/issues)
- 📖 **ドキュメント**: [Wiki](https://github.com/meso/vibebase/wiki)

---

**Vibebase** - Made with ❤️ for Vibe Coders who want to focus on building great experiences with AI.