# Vibebase E2E Tests

チームタスク管理アプリケーションを使用したVibebaseのE2Eテストスイート

## 📋 概要

このE2Eテストスイートは、Vibebaseの全機能を網羅的にテストするために設計されています。実際のチームタスク管理アプリケーションのシナリオを使用して、以下の機能をテストします：

- **認証**: 管理者認証（vibebase-auth）、ユーザー認証（内部JWT）、APIキー認証
- **データベース操作**: CRUD操作、バルク操作、フィルタリング、RBAC
- **リアルタイム機能**: Server-Sent Events (SSE)、データ変更通知
- **プッシュ通知**: Web Push API、VAPID、デバイス管理
- **ストレージ**: ファイルアップロード/ダウンロード、R2統合
- **カスタムSQL**: パラメーター付きクエリ、キャッシュ機能

## 🏗️ テストデータ構造

### データベーススキーマ
```
users ← user_sessions
  ├─ teams → members → users
  │    ↓
  │  projects
  │    ↓
  │  tasks ← task_comments
  │    ↓ 
  │  task_attachments
  │
  ├─ push_subscriptions
  ├─ push_notification_rules  
  ├─ push_notification_logs
  ├─ realtime_hooks
  ├─ realtime_events
  └─ custom_queries
```

### テストシナリオ
1. **Engineering Team**: 4人のメンバーでAPI開発とモバイルアプリ開発
2. **Marketing Team**: 3人のメンバーでキャンペーン管理とコンテンツ戦略
3. **Design Team**: 3人のメンバーでデザインシステム構築

## 🚀 セットアップ

### 前提条件

1. **Node.js v18以上** と **pnpm** がインストールされていること
2. **Cloudflare Wrangler** がインストールされていること（`npm install -g wrangler`）
3. GitHubからリポジトリをクローンしていること
4. **Vibebaseサーバーが localhost:8787 で動作していること**

### ⚠️ 重要な注意事項

E2Eテストを実行する前に、**必ずVibebaseサーバーを起動してください**：

```bash
# packages/core ディレクトリで実行
cd packages/core
pnpm dev
```

サーバーが起動していない場合、全てのテストが失敗します。

### 🚀 クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/vibebase/vibebase.git
cd vibebase

# 2. 依存関係をインストール
pnpm install

# 3. Vibebaseサーバーを起動（別ターミナルで実行）
cd packages/core
pnpm dev

# 4. E2Eテストを実行（別ターミナルで実行）
cd tests/e2e
npm run setup    # テスト環境の初期化
npm run seed     # テストデータの投入
npm test         # E2Eテストの実行
npm run teardown # テストデータのクリーンアップ
```

### 詳細な手順

#### 1. プロジェクト全体の依存関係インストール

```bash
# プロジェクトルートで実行
pnpm install
```

#### 2. Vibebaseサーバーの起動

```bash
# packages/core ディレクトリで実行
cd packages/core
pnpm dev
```

サーバーが `http://localhost:8787` で起動することを確認してください。

#### 3. E2Eテストディレクトリに移動

```bash
cd tests/e2e
```

## 🧪 テスト実行

### 完全なE2Eテストサイクル

```bash
# 1. テスト環境のセットアップ
npm run setup

# 2. テストデータの投入
npm run seed

# 3. E2Eテストの実行
npm test

# 4. テストデータのクリーンアップ
npm run teardown
```

### 各コマンドの説明

#### Setup（セットアップ）
```bash
npm run setup
```
- `.env.test` ファイルの自動生成
- 既存のテーブルとインデックスの削除
- コア & テスト用データベーススキーマの適用
- テスト用APIキーの登録
- VAPID公開/秘密鍵の初期化
- ユーザーセッション（Alice、Bob、Charlie）の作成

#### Seed（データ投入）
```bash
npm run seed
```
- テストユーザーの作成（Alice、Bob、Charlie、Diana、Eve）
- チーム、プロジェクト、タスクの作成
- チームメンバーシップとプロファイルの設定
- タスクコメントの作成
- テストデータIDのストレージへの保存

#### Test（テスト実行）
```bash
npm test
```
全テストファイルでE2Eテストを実行

#### Teardown（クリーンアップ）
```bash
npm run teardown
```
- 全てのテストデータの削除
- ストレージファイルのクリーンアップ
- データベースの初期状態への復元

### 個別テストの実行

```bash
# 認証テストのみ
npm test auth.test.ts

# チーム管理テストのみ
npm test teams.test.ts

# ユーザー認証テストのみ
npm test user-auth.test.ts

# リアルタイム機能テストのみ
npm test realtime.test.ts

# プッシュ通知テストのみ
npm test push-notifications.test.ts
```

### 開発用テストモード

```bash
# UIモードでテスト実行
npm run test:ui

# ウォッチモードでテスト実行
npm run test:watch

# 型チェック
npm run typecheck

# Lint
npm run lint
```

## 📊 テスト構成

### テストファイル一覧

| ファイル | 説明 | 主要機能 |
|----------|------|----------|
| `auth.test.ts` | 管理者認証とAPIキー認証 | GitHub OAuth、トークン検証 |
| `user-auth.test.ts` | ユーザー認証とアクセス制御 | RBAC、データフィルタリング |
| `teams.test.ts` | チーム管理（管理者権限） | CRUD、メンバー管理 |
| `teams-user.test.ts` | チーム管理（ユーザー権限） | 権限制御テスト |
| `tasks.test.ts` | タスク管理（管理者権限） | CRUD、コメント、バルク操作 |
| `tasks-user.test.ts` | タスク管理（ユーザー権限） | 所有者ベースアクセス |
| `storage.test.ts` | ストレージ機能（管理者） | ファイルアップロード/ダウンロード |
| `storage-user.test.ts` | ストレージ機能（ユーザー） | 権限付きファイル操作 |
| `storage-real-files.test.ts` | 実ファイル操作テスト | 画像・PDF・バイナリファイル |
| `realtime.test.ts` | リアルタイム機能（管理者） | SSE、フック管理 |
| `realtime-user.test.ts` | リアルタイム機能（ユーザー） | データ変更通知 |
| `push-notifications.test.ts` | プッシュ通知（管理者） | VAPID、通知ルール |
| `push-notifications-user.test.ts` | プッシュ通知（ユーザー） | 購読管理、受信 |
| `custom-sql.test.ts` | カスタムSQL機能 | パラメーター、キャッシュ |

### テストカバレッジ

- ✅ **認証**: 管理者認証（RS256）、ユーザー認証（HS256）、APIキー認証
- ✅ **CRUD操作**: 作成、読み取り、更新、削除、バルク操作
- ✅ **アクセス制御**: RBAC、所有者ベースフィルタリング、テーブルポリシー
- ✅ **リアルタイム**: SSE接続、データ変更通知、フック管理
- ✅ **プッシュ通知**: VAPID設定、デバイス登録、通知配信
- ✅ **ストレージ**: ファイル操作、メタデータ、権限制御
- ✅ **カスタムSQL**: 動的クエリ、パラメーター、キャッシュ
- ✅ **エラーハンドリング**: 無効な入力、権限エラー、型安全性

## 🔧 設定ファイル

### `.env.test`
`npm run setup` 実行時に自動生成されます：
```env
VIBEBASE_API_URL=http://localhost:8787
VIBEBASE_API_KEY=vb_live_test123456789012345678901234567890
CLEANUP_BEFORE_TEST=true
```

### `package.json` スクリプト
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "setup": "tsx --env-file .env.test team-task-app/setup.ts",
    "seed": "tsx --env-file .env.test team-task-app/seed.ts", 
    "teardown": "tsx --env-file .env.test team-task-app/teardown.ts",
    "typecheck": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write ."
  }
}
```

### `vitest.config.ts`
- タイムアウト: 30秒
- 環境: Node.js  
- Globals: Vitestグローバル関数
- EventSource: Node.js polyfill

## 🐛 トラブルシューティング

### よくある問題

1. **サーバーが起動していない**
   ```bash
   # エラー: Failed to fetch http://localhost:8787
   cd packages/core
   pnpm dev
   ```

2. **テストデータが古い**
   ```bash
   npm run teardown
   npm run setup
   npm run seed  
   ```

3. **型エラーが発生する**
   ```bash
   npm run typecheck  # 型エラーの詳細確認
   pnpm typecheck     # ルートレベルでの全体チェック
   ```

4. **Lintエラー**
   ```bash
   npm run lint       # エラー確認
   npm run lint:fix   # 自動修正
   ```

5. **プッシュ通知テストが失敗**
   - VAPID設定を確認
   - setup時のVAPID初期化を確認

6. **リアルタイムテストがタイムアウト**
   - SSE接続を確認
   - Durable Objects設定を確認

### ログ確認

```bash
# Vibebaseサーバーのログ
cd packages/core
pnpm dev

# テストの詳細ログ  
cd tests/e2e
npm test -- --reporter=verbose

# 型チェック詳細
npm run typecheck
```

### 完全リセット

```bash
# 1. テストデータのクリーンアップ
npm run teardown

# 2. Wranglerデータのクリア
cd packages/core
rm -rf .wrangler

# 3. データベース再初期化
pnpm db:init

# 4. サーバー再起動
pnpm dev

# 5. E2Eテスト再セットアップ
cd ../../tests/e2e
npm run setup
npm run seed
```

## 🏗️ アーキテクチャ

### 認証フロー
- **管理者**: GitHub OAuth → vibebase-auth → RS256 JWT → AdminAuthManager
- **ユーザー**: 内部認証 → HS256 JWT → UserAuthManager  
- **API**: API Key → APIKeyManager

### データフロー
1. HTTP Request → Hono Router
2. Multi-Auth Middleware → 認証検証
3. RBAC Middleware → 権限チェック
4. Route Handler → ビジネスロジック
5. D1 Database → データ操作
6. Response → JSON/SSE

### リアルタイム
1. データ変更 → Database Trigger
2. Realtime Hook → Event Generation  
3. Durable Object → Connection Management
4. SSE → Client Notification

## 🤝 貢献

新しいテストケースを追加する場合：

1. 適切なテストファイルに追加
2. テストデータが必要な場合は `fixtures/seed-data.ts` を更新
3. 型定義は `fixtures/types.ts` を更新
4. クリーンアップ処理を確実に実装  
5. このREADMEを更新

### テストファイルの命名規則
- `*.test.ts`: 管理者権限でのテスト
- `*-user.test.ts`: ユーザー権限でのテスト  
- 機能名を明確に表現（例：`push-notifications.test.ts`）

## 📝 ライセンス

Elastic License 2.0