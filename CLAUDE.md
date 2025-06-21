# Vibebase - Personal BaaS for Vibe Coders on Cloudflare

このドキュメントは、Vibebaseプロジェクトの開発支援のためにClaude（とユーザー）に重要なコンテキストを提供します。

## プロジェクト概要

Vibebaseは、Cloudflare上で動作する、AIを活用してコードを書く開発者（Vibe Coders）のためのパーソナルBackend-as-a-Service（BaaS）プラットフォームです。フロントエンドやモバイルアプリ開発が得意な開発者が、バックエンドインフラの複雑さに悩まされることなく、得意分野に集中できることを目指しています。

### プロジェクトの目標

- **ワンクリックデプロイ**: GitHubから1クリックでCloudflareにデプロイ
- **フルスタックTypeScript**: 型安全性と開発体験の向上
- **Cloudflareエコシステム**: Workers、D1、R2などのCloudflareサービスを活用
- **開発者フレンドリー**: 最小限の設定で、すぐに使い始められる

### 対象ユーザー

- AIツールを活用して効率的にコードを書くVibe Coders
- 自分の得意分野（フロントエンド・モバイル開発）に集中したい開発者
- バックエンドインフラの構築に時間をかけたくない開発者
- Cloudflareのサービスをシンプルに活用したい開発者

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2
- **認証**: [vibebase-auth](https://github.com/vibebase/vibebase-auth) + JWT (RS256)
- **フロントエンド**: Preact + Vite + Tailwind CSS
- **アセット配信**: Cloudflare Workers Assets
- **ビルドツール**: Wrangler, Vite
- **テスト**: Vitest, Miniflare

## プロジェクト構造

```
vibebase/
├── packages/
│   ├── core/              # コアAPI（Hono + Workers）
│   ├── dashboard/         # 管理ダッシュボード（Preact）
│   ├── sdk/              # クライアントSDK（予定）
│   └── cli/              # CLIツール（予定）
├── examples/             # サンプルアプリケーション
├── docs/                 # ドキュメント
├── deploy/              # デプロイメント設定
├── DEPLOYMENT.md        # デプロイ手順
└── README.md           # ユーザー向けドキュメント
```

## 機能実装状況

### ✅ 実装済み

#### 1. 管理ダッシュボード
- Cloudflare Workers + Workers Assetsで動作するWebベースの管理画面
- バックエンドリソースを管理するための直感的なUI/UX
- リアルタイムでのデータ表示・編集
- Workers Assetsによる高速なアセット配信

#### 2. データベース（D1）
- Cloudflare D1を使用したSQLiteベースのデータベース
- ダッシュボード経由でのテーブル作成・編集・削除
- SQLクエリエディタ
- データのインポート/エクスポート機能
- スキーマ履歴管理（マイグレーション追跡）
- 基本的なCRUD操作のためのREST API自動生成
- インデックス付きカラムでの検索機能
- スキーマスナップショット機能
- インデックス管理

#### 3. ストレージ（R2）
- Cloudflare R2を使用したオブジェクトストレージ
- ファイルアップロード/ダウンロード/削除API
- アクセス制御とプリサインURL生成

#### 4. 認証（管理者）
- [vibebase-auth](https://github.com/vibebase/vibebase-auth)中央認証サーバーとの統合
- GitHub OAuth認証
- JWTトークンベースの認証（RS256署名検証）
- 自動トークンリフレッシュ
- セキュアなクッキー管理（HttpOnly, Secure, SameSite=Strict）
- 全ルートを保護する認証ミドルウェア

#### 5. API Key認証
- プログラマティックアクセス用のAPIキー管理
- スコープベースのアクセス制御
- セキュアなキー生成と検証
- 管理者ダッシュボードでのキー管理

#### 6. エンドユーザー認証
- [vibebase-auth](https://github.com/vibebase/vibebase-auth)統合によるGitHub OAuth
- ユーザー管理API（CRUD操作）
- JWTトークンベースの認証
- ユーザーセッション管理

#### 7. RBAC（Role-Based Access Control）
- テーブルレベルのアクセスポリシー（public/private）
- 所有者ベースのデータフィルタリング
- ユーザー認証時の自動データアクセス制御
- 管理者・APIキー認証時の全データアクセス
- usersテーブルの自己参照型アクセス制御

#### 8. アプリケーション設定
- アプリ名、URL、サポートメール等のカスタマイズ
- OAuth認証時のUser-Agent設定
- 設定ページのナビゲーション機能

#### 9. リアルタイム機能
- データ変更イベントのフック機能（insert/update/delete）
- Server-Sent Events（SSE）によるリアルタイム通知
- Durable Objectsを使用した接続管理
- 即時ブロードキャスト（waitUntil + 自動フォールバック）
- フック管理API（作成・削除・有効/無効切り替え）
- イベントキューによる信頼性保証
- 認証統合（Admin/User/API Key対応）
- アクセス制御（owner_idベースのフィルタリング）

#### 10. カスタムSQL API
- 管理画面での任意SQL登録・実行機能
- パラメーター付きクエリのサポート（:param_name記法）
- SQLからの自動パラメーター抽出・バリデーション
- GET/POSTメソッド対応
- 日本語名に対応したslug自動生成（ハッシュベース）
- キャッシュ機能（TTL設定）
- Read-onlyクエリの強制適用
- 管理画面でのテスト実行機能
- パラメーター型定義（string/number/boolean/date）
- クエリの有効/無効切り替え

### 📋 予定

#### 匿名ユーザー認証
- デバイスIDベースの匿名認証システム
- ユーザー登録不要での即座利用開始
- localStorage/AsyncStorageでのデバイス識別
- 匿名ユーザーから正式ユーザーへのシームレスアップグレード
- PWA・モバイルアプリでのゲストユーザー体験向上
- プライバシー配慮（個人情報不要）でのデータ管理

#### Webhook Cron機能
- 開発者が指定したURLに定期的にHTTPリクエストを送信
- Cron式による柔軟なスケジューリング（毎分、毎時、毎日等）
- カスタムHTTPメソッド・ヘッダー・ボディの設定
- リトライ機構とエラーハンドリング
- 実行履歴とモニタリング機能
- 外部システム連携・データ同期・定期レポート生成に活用

#### Push通知
- Web Push / FCMを使用したプッシュ通知
- トピックベースの通知配信
- スケジュール通知
- 通知テンプレート機能

#### 環境管理
- 本番環境と開発環境の分離
- 環境ごとのデータベース管理
- 環境間でのスキーマ同期

## 開発コマンド

### ルートレベル
```bash
pnpm dev         # 全ての開発サーバーを並列起動
pnpm build       # 全てのパッケージをビルド
pnpm run deploy  # プロジェクト全体をデプロイ（推奨：ダッシュボードビルド→アセットクリーンアップ・コピー→coreのCloudflareデプロイまで全自動実行）
pnpm test run    # 全てのテストを実行（watchモードを無効化）
pnpm lint        # 全てのパッケージでリンティング実行
pnpm typecheck   # 全てのパッケージで型チェック実行
```

### コアパッケージ（packages/core）
```bash
pnpm dev         # Wrangler開発サーバーを起動
pnpm run deploy  # Cloudflareにデプロイ
pnpm db:init     # D1データベースを初期化
pnpm test run    # Vitestテストを実行（watchモードを無効化）
pnpm typecheck   # TypeScript型チェックを実行
```

### ダッシュボードパッケージ（packages/dashboard）
```bash
pnpm dev         # Vite開発サーバーを起動
pnpm build       # ダッシュボードをビルドしてcoreにアセットをコピー
pnpm typecheck   # TypeScript型チェックを実行
```

## リアルタイム機能の使用方法

### フック作成
```bash
# テーブルのinsertイベントにフックを作成
curl -X POST https://vibebase.mesongo.workers.dev/api/hooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"table_name": "users", "event_type": "insert"}'
```

### SSE接続（JavaScript/React Native）
```javascript
const eventSource = new EventSource('https://vibebase.mesongo.workers.dev/api/realtime/sse', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('リアルタイムイベント:', data);
};
```

### イベント処理（Cron推奨）
```bash
# 失敗したイベントの再送信（5分ごとに実行推奨）
curl -X POST https://vibebase.mesongo.workers.dev/api/realtime/process-events \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 動作フロー
1. **データ変更** → 即座にSSEクライアントに配信（数百ms）
2. **フォールバック** → 失敗時はイベントキューに記録
3. **再送信** → Cronで定期的な失敗イベント再送信

## 開発ガイドライン

### テスト戦略
- **100%テスト成功の維持**: 全てのテストが常に成功する状態を絶対に保つ
- **継続的テスト実行**: 機能追加・修正時には必ずテストを実行し、全て成功することを確認
- **包括的テストカバレッジ**: リファクタリング対象の機能に対して包括的なテストを作成
- **テスト駆動開発**: リファクタリング前後でテストが通ることを確認
- **動作保証**: 外部から見た動作が変わらないことを保証
- **テスト品質**: ユニットテスト、インテグレーションテスト、エンドツーエンドテストの適切な組み合わせ

### リファクタリング方針
1. **継続的なリファクタリング**: コードの品質と保守性を向上させるため定期的にリファクタリングを実施
2. **テスト駆動リファクタリング**: リファクタリング前には必ず十分なテストを追加し、動作が変わらないことを保証

### コードスタイル
- 全てのコードでTypeScriptを使用
- 一貫した命名規則に従う：
  - 変数と関数: camelCase
  - 型とインターフェース: PascalCase
  - 定数: UPPER_SNAKE_CASE
- 意味のある変数名・関数名を使用
- パブリックAPIにはJSDocコメントを記述
- 厳格なTypeScript設定を使用

### セキュリティ
- シークレットやAPIキーをコミットしない
- 機密データには環境変数を使用
- 認証に関してはセキュリティベストプラクティスに従う
- 依存関係を定期的に更新

## ライセンス

Elastic License 2.0

**要約**:
- ✅ 個人・商用利用可能（自分のアプリのバックエンドとして）
- ✅ 修正・再配布可能
- ❌ SaaS/PaaSとして第三者に提供することは禁止

## important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
ALWAYS discuss and agree on the approach/design before implementation. Never jump straight into implementation without first proposing the plan, discussing it with the user, and getting agreement on "that sounds good" before proceeding with actual code/document changes.

## Memories
- コマンドを実行する前に、今いるフォルダがどこなのかを確認しましょう
- デプロイ時は **ルートで `pnpm run deploy`** を使用する（ダッシュボードビルド→アセットクリーンアップ・コピー→coreのCloudflareデプロイまで全自動実行される）