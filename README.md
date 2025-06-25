# Vibebase 🎵

> **Personal BaaS for Vibe Coders** - Vibe CoderのためのミニマムなBackend-as-a-Service on Cloudflare

⚠️ **Work in Progress** - このプロジェクトは現在開発中です。基本機能は動作しますが、まだ実験的な段階にあります。本番環境での使用は推奨されません。

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy%20to-Cloudflare-orange?style=for-the-badge&logo=cloudflare)](https://github.com/vibebase/vibebase/actions/workflows/deploy.yml)

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

### 🎯 1-Click 自動デプロイ

1. **GitHub アカウントでログイン**して、下記ボタンをクリック
2. **Cloudflare API Token**を設定（初回のみ）
3. **Worker名を入力**（オプション）
4. **Deploy**ボタンをクリック
5. **完了！**あなたのVibebaseインスタンスが稼働開始

[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy%20to-Cloudflare-orange?style=for-the-badge&logo=cloudflare)](https://github.com/vibebase/vibebase/actions/workflows/deploy.yml)

**📋 必要な準備**
1. [Cloudflare アカウント](https://dash.cloudflare.com)を作成
2. [Cloudflare API Token](https://dash.cloudflare.com/profile/api-tokens)を取得
   - Template: **Custom token**
   - Permissions: `Workers:Edit`, `D1:Edit`, `R2:Edit`, `KV:Edit`

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

### ✅ 実装済み（v0.1.0 MVP + v0.2.0 + v0.3.0）

- 🏗️ **管理ダッシュボード** - Webベースの管理画面
- 🗄️ **データベース機能（D1）** - SQLiteベースのデータベース
- 🔧 **基本的なCRUD API** - REST APIの自動生成
- 📦 **ワンクリックデプロイ** - GitHub経由のデプロイ
- 💾 **ストレージ（R2）** - ファイルアップロード・ダウンロード・削除
- 🔍 **検索機能** - インデックス付きカラムでの高速検索
- 🔐 **管理者認証** - GitHub OAuthとJWT認証（[vibebase-auth](https://github.com/vibebase/vibebase-auth)統合）
- 📸 **スキーマスナップショット** - データベーススキーマのバックアップ
- 🔗 **インデックス管理** - データベースインデックスの作成・削除
- 🔑 **API Key認証** - プログラマティックアクセス用のAPIキー管理
- ⚙️ **アプリケーション設定** - アプリ名、URL等のカスタマイズ
- 🛡️ **RBAC（Role-Based Access Control）** - テーブルレベルのアクセス制御
  - テーブルポリシー管理（public/private）
  - ユーザー認証時のデータフィルタリング
  - 所有者ベースのアクセス制御
- ⚡ **リアルタイム機能** - 真のリアルタイム通知
  - Server-Sent Events（SSE）による即座なデータ配信
  - データ変更イベントのフック機能（insert/update/delete）
  - Durable Objectsを使用した接続管理
  - 即時ブロードキャスト（waitUntil + 自動フォールバック）
  - 認証統合とアクセス制御対応
- 🔧 **カスタムSQL API** - 柔軟なデータアクセス
  - 管理画面での任意SQL登録・実行
  - パラメーター付きクエリのサポート
  - SQLからの自動パラメーター抽出
  - GET/POSTメソッド対応
  - キャッシュ機能とアクセス制御
- 🔔 **Web Push通知** - リッチなプッシュ通知機能
  - Web Push APIを使用したブラウザ通知
  - VAPID認証による安全な通知配信
  - 管理ダッシュボードでの通知ルール管理
  - データベース変更トリガーによる自動通知
  - 手動通知送信API
  - Service Workerによるオフライン対応
  - 通知配信ログと分析

### 🚧 開発予定

- 📱 **FCM対応** - モバイルアプリ向けプッシュ通知
- 🛠️ **CLIツール** - 開発効率化ツール
- 🌍 **環境管理** - 本番/開発環境の分離

## 🏗️ 技術スタック

- **言語**: TypeScript
- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2
- **アセット配信**: Cloudflare Workers Assets
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

### データ操作
```bash
# レコード作成
curl -X POST https://your-worker.your-subdomain.workers.dev/api/data/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# レコード一覧
curl https://your-worker.your-subdomain.workers.dev/api/data/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### リアルタイム機能
```bash
# フック作成（データ変更を監視）
curl -X POST https://your-worker.your-subdomain.workers.dev/api/hooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"table_name": "users", "event_type": "insert"}'
```

```javascript
// SSE接続（JavaScript/React Native）
const eventSource = new EventSource('https://your-worker.your-subdomain.workers.dev/api/realtime/sse', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('リアルタイムイベント:', data);
  // データ変更が即座に通知される（数百ms）
};
```

### Web Push通知
```javascript
// Service Workerの登録とプッシュ通知の購読
async function subscribeToPush() {
  // Service Workerの登録
  const registration = await navigator.serviceWorker.register('/sw.js');
  
  // VAPID公開鍵の取得
  const response = await fetch('/api/push/vapid-public-key');
  const { publicKey } = await response.json();
  
  // プッシュ通知の購読
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey
  });
  
  // サーバーに購読情報を送信
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ subscription })
  });
}
```

```bash
# 手動通知の送信（管理者のみ）
curl -X POST https://your-worker.your-subdomain.workers.dev/api/push/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "userIds": ["user123"],
    "title": "新着メッセージ",
    "body": "重要なお知らせがあります",
    "icon": "/favicon.svg"
  }'
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

### Phase 2: 認証とストレージ (v0.2.0) ✅ 完了
- [x] **管理者認証実装**（[vibebase-auth](https://github.com/vibebase/vibebase-auth)統合）
  - [x] GitHub OAuth認証
  - [x] JWTトークン検証とセキュリティ
  - [x] 自動トークンリフレッシュ
  - [x] 認証ミドルウェアとルート保護
- [x] **API Key認証システム**
  - [x] APIキー生成・管理
  - [x] スコープベースのアクセス制御
  - [x] セキュアなキー検証
- [x] **エンドユーザー認証基盤**（アプリ利用者向け）
  - [x] GitHub OAuth対応
  - [x] ユーザー管理API（CRUD）
  - [x] RBAC（ロールベースアクセス制御）
  - [x] テーブルレベルのアクセスポリシー
  - [x] 所有者ベースのデータフィルタリング
- [x] **アプリケーション設定**
  - [x] アプリ名・URL等のカスタマイズ
  - [x] OAuth User-Agent設定
- [x] R2ストレージ統合
- [x] ファイルアップロードAPI

### Phase 3: リアルタイム機能 (v0.3.0) ✅ 完了
- [x] **リアルタイムDB機能**
  - [x] データ変更イベントのフック機能（insert/update/delete）
  - [x] Server-Sent Events（SSE）による即座なデータ配信
  - [x] Durable Objectsを使用した接続管理
  - [x] 即時ブロードキャスト（waitUntil + 自動フォールバック）
  - [x] フック管理API（作成・削除・有効/無効切り替え）
  - [x] イベントキューによる信頼性保証
  - [x] 認証統合（Admin/User/API Key対応）
  - [x] アクセス制御（owner_idベースのフィルタリング）

### Phase 4: 開発体験向上 (v0.4.0)
- [x] **カスタムSQL API** - 管理画面で任意のSQLクエリを登録してAPI化
- [x] **Web Push通知** - ブラウザ向けプッシュ通知機能の実装
- [ ] **匿名ユーザー認証** - デバイスIDベースの認証でユーザー登録不要の即座利用
- [ ] **Webhook Cron機能** - 開発者が指定したURLに定期的にHTTPリクエストを送信
- [ ] FCM対応（モバイルアプリ向けプッシュ通知）
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