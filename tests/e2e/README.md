# Vibebase E2E Tests

チームタスク管理アプリケーションを使用したVibebaseのE2Eテストスイート

## 📋 概要

このE2Eテストスイートは、Vibebaseの全機能を網羅的にテストするために設計されています。実際のチームタスク管理アプリケーションのシナリオを使用して、以下の機能をテストします：

- **認証**: APIキー認証とJWTトークン認証
- **データベース操作**: CRUD操作、バルク操作、フィルタリング
- **リアルタイム機能**: Server-Sent Events (SSE)
- **アクセス制御**: RBAC（Role-Based Access Control）
- **ストレージ**: ファイルアップロード/ダウンロード

## 🏗️ テストデータ構造

### データベーススキーマ
```
teams → team_members → users
  ↓
projects
  ↓
tasks ← task_comments
  ↓
task_attachments
  ↓
activity_logs
```

### テストシナリオ
1. **Engineering Team**: 5人のメンバーでAPI開発とモバイルアプリ開発
2. **Marketing Team**: 3人のメンバーでキャンペーン管理
3. **Design Team**: 3人のメンバーでデザインシステム構築

## 🚀 セットアップ

### 前提条件

1. **Node.js v18以上** と **pnpm** がインストールされていること
2. **Cloudflare Wrangler** がインストールされていること（`npm install -g wrangler`）
3. GitHubからリポジトリをクローンしていること

### ⚠️ 初回実行時の注意事項

GitHubからクローンした直後は、以下の手順を **必ず順番通りに** 実行してください：

1. **依存関係のインストール** （プロジェクトルートで）
2. **Wrangler設定ファイルの作成**
3. **環境変数の設定**
4. **データベースの初期化**
5. **サーバーの起動**
6. **テストの実行**

これらの手順をスキップすると、エラーが発生する可能性があります。

### 🚀 クイックスタート（初回のみ）

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-username/vibebase.git
cd vibebase

# 2. 依存関係をインストール
pnpm install

# 3. Wrangler設定をコピー
cd packages/core
cp wrangler.toml wrangler.local.toml

# 4. wrangler.local.tomlを編集
# database_id と kv_namespaces.id を "local" に変更

# 5. データベースを初期化
pnpm db:init

# 6. 開発サーバーを起動（別ターミナルで）
pnpm dev

# 7. E2Eテストを実行（別ターミナルで）
cd ../../tests/e2e
pnpm setup
pnpm seed
pnpm test
```

### 1. プロジェクト全体の依存関係インストール

```bash
# プロジェクトルートで実行
pnpm install
```

### 2. ローカル開発環境の準備

#### a. Wrangler設定ファイルの作成

```bash
# packages/core ディレクトリで実行
cd packages/core
cp wrangler.toml wrangler.local.toml
```

`wrangler.local.toml` を編集して、以下の値を設定：
- `database_id = "placeholder"` → `database_id = "local"` に変更
- `id = "placeholder"` (kv_namespaces内) → `id = "local"` に変更

注：`"local"`を指定すると、Wranglerはローカルファイルシステムを使用します。
Cloudflareアカウントなしで開発できます。

#### b. ローカル環境変数の設定

```bash
# packages/core/.dev.vars ファイルを作成（存在しない場合）
cd packages/core
touch .dev.vars
```

`.dev.vars` ファイルに以下を設定：
```
# JWT Secret for E2E testing
# 任意の複雑な文字列（32文字以上推奨）
JWT_SECRET="your-secret-key-here-make-it-long-and-random"
```

#### c. データベースの初期化

```bash
# packages/core ディレクトリで実行
pnpm db:init
```

### 3. E2Eテスト環境の設定

```bash
# E2Eテストディレクトリに移動
cd tests/e2e

# E2Eテストの依存関係をインストール（既にルートでインストール済みの場合はスキップ可）
pnpm install
```

### 4. Vibebaseサーバーの起動

```bash
# 別のターミナルで packages/core ディレクトリから実行
cd packages/core
pnpm dev
```

サーバーが `http://localhost:8787` で起動することを確認してください。

### 5. テストの初期セットアップ

```bash
# tests/e2e ディレクトリで実行
# .env.test ファイルの自動生成とテスト用テーブルの作成
pnpm setup
```

このコマンドは以下を実行します：
- `.env.test` ファイルの自動生成（存在しない場合）
- 既存のテーブルとインデックスの削除
- コアスキーマの適用
- テスト用スキーマの適用
- テスト用APIキーの登録

### 6. テストデータの投入

```bash
# テストデータを投入
pnpm seed
```

## 🧪 テスト実行

### すべてのテストを実行
```bash
pnpm test
```

### 特定のテストファイルを実行
```bash
# 認証テストのみ
pnpm test auth.test.ts

# チーム管理テストのみ
pnpm test teams.test.ts

# タスク管理テストのみ
pnpm test tasks.test.ts

# リアルタイム機能テストのみ
pnpm test realtime.test.ts
```

### UIモードでテスト実行
```bash
pnpm test:ui
```

### ウォッチモードでテスト実行
```bash
pnpm test:watch
```

## 🧹 クリーンアップ

```bash
# テストデータをクリーンアップ
pnpm teardown
```

## 📊 テスト構成

### テストファイル

| ファイル | 説明 | テスト数 |
|----------|------|----------|
| `auth.test.ts` | 認証機能のテスト | 12 |
| `teams.test.ts` | チーム管理機能のテスト | 15 |
| `tasks.test.ts` | タスク管理機能のテスト | 18 |
| `realtime.test.ts` | リアルタイム機能のテスト | 10 |

### テストカバレッジ

- **認証**: APIキー認証、JWT認証、権限管理
- **CRUD操作**: 作成、読み取り、更新、削除
- **バルク操作**: 一括作成、一括更新、一括削除
- **フィルタリング**: 複雑な条件でのデータ取得
- **リアルタイム**: データ変更の即座反映
- **エラーハンドリング**: 無効な入力、権限エラー

## 🔧 設定ファイル

### `.env.test`
`pnpm setup` 実行時に自動生成されます。内容は以下の通り：
```env
VIBEBASE_API_URL=http://localhost:8787
VIBEBASE_API_KEY=vb_live_test123456789012345678901234567890
CLEANUP_BEFORE_TEST=true
```

### `vitest.config.ts`
- タイムアウト: 30秒
- 環境: Node.js
- 順序: 固定（リアルタイムテストの安定性のため）

## 📈 CI/CD統合

### GitHub Actions

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: pnpm install
        
      - name: Start Vibebase server
        run: |
          cd packages/core
          pnpm dev &
          
      - name: Wait for server
        run: |
          timeout 30 bash -c 'until curl -f http://localhost:8787/health; do sleep 1; done'
          
      - name: Setup E2E tests
        run: |
          cd tests/e2e
          pnpm setup
          pnpm seed
          
      - name: Run E2E tests
        run: |
          cd tests/e2e
          pnpm test
          
      - name: Cleanup
        if: always()
        run: |
          cd tests/e2e
          pnpm teardown
```

### ローカル開発での使用

```bash
# 開発用のワンライナー
pnpm dev:e2e

# 実際は以下のコマンドの組み合わせ
# 1. cd packages/core && pnpm dev &
# 2. cd tests/e2e && pnpm setup && pnpm seed
# 3. cd tests/e2e && pnpm test:watch
```

## 🐛 トラブルシューティング

### よくある問題

1. **サーバーが起動しない**
   ```bash
   # D1データベースの初期化
   cd packages/core
   pnpm db:init
   
   # wrangler.local.tomlが存在しない場合
   cp wrangler.toml wrangler.local.toml
   # database_id と kv_namespaces.id を "local" に変更
   ```

2. **テストデータが見つからない**
   ```bash
   # シードデータを再投入
   cd tests/e2e
   pnpm teardown
   pnpm seed
   ```

3. **リアルタイムテストが失敗する**
   ```bash
   # タイムアウトを延長
   export VITEST_TIMEOUT=60000
   pnpm test realtime.test.ts
   ```

4. **権限エラー**
   - `.env.test`のAPIキーを確認
   - Vibebaseの認証設定を確認
   - JWT_SECRETが`.dev.vars`に設定されているか確認

5. **"Cannot find module '@vibebase/sdk'"エラー**
   ```bash
   # プロジェクトルートで実行
   pnpm install
   pnpm build
   ```

6. **ポート8787が既に使用中**
   ```bash
   # 既存のプロセスを確認
   lsof -i :8787
   # プロセスを終了
   kill -9 <PID>
   ```

7. **データベース関連のエラー**
   ```bash
   # Wranglerのデータをクリア
   rm -rf .wrangler
   # データベースを再初期化
   cd packages/core
   pnpm db:init
   ```

### ログ確認

```bash
# Vibebaseサーバーのログ
cd packages/core
pnpm dev

# テストの詳細ログ
cd tests/e2e
pnpm test --reporter=verbose
```

## 🤝 貢献

新しいテストケースを追加する場合：

1. 適切なテストファイルに追加
2. テストデータが必要な場合は`fixtures/seed-data.ts`を更新
3. クリーンアップ処理を確実に実装
4. READMEを更新

## 📝 ライセンス

Elastic License 2.0