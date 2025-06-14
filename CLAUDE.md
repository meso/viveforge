# Vibebase - Personal BaaS for Vibe Coders on Cloudflare

## 概要

Vibebaseは、Cloudflare上で動作する、AIを活用してコードを書く開発者（Vibe Coders）のためのパーソナルBackend-as-a-Service（BaaS）プラットフォームです。フロントエンドやモバイルアプリ開発が得意な開発者が、バックエンドインフラを簡単に構築・管理できることを目指しています。

## プロジェクトの目的

- **簡単なデプロイ**: GitHubから1クリックでCloudflareアカウントにデプロイ可能
- **フルスタックTypeScript**: 型安全性と開発体験の向上
- **Cloudflareエコシステムの活用**: Workers、D1、R2などのCloudflareサービスをフル活用
- **個人開発者フレンドリー**: 複雑な設定不要で、すぐに使い始められる

## ターゲットユーザー

- AIを活用して効率的にコードを書くVibe Coders
- フロントエンド・モバイルアプリ開発に集中したい開発者
- バックエンドインフラの構築に時間をかけたくない開発者
- Cloudflareのサービスをシンプルに活用したい開発者

## 主要機能

### 1. 管理ダッシュボード
- Cloudflare Workers上で動作するWebベースの管理画面
- 直感的なUI/UXでバックエンドリソースを管理
- リアルタイムでのデータ確認・編集

### 2. データベース機能（D1）
- Cloudflare D1を使用したSQLiteベースのデータベース
- ダッシュボード上でのテーブル作成・編集・削除
- SQLクエリエディタ
- データのインポート/エクスポート機能
- スキーマの履歴管理（マイグレーション履歴の追跡）
- 基本的なCRUD操作のためのREST APIの自動生成

### 3. リアルタイムDB機能
- レコードの追加・更新・削除をトリガーとしたタスク実行
- WebSocketまたはServer-Sent Eventsによるリアルタイム通知
- カスタムフック・イベントハンドラーの設定

### 4. 環境管理
- 本番環境と開発環境の分離
- 環境ごとのデータベース管理
- 環境間でのスキーマ同期機能

### 5. ストレージ（R2）
- Cloudflare R2を使用したオブジェクトストレージ
- ファイルアップロード/ダウンロードAPI
- 画像リサイズ・最適化機能
- アクセス制御とプリサインURL生成

### 6. 認証機能
- Honoの OAuth Providers Middlewareを活用
- 対応プロバイダー:
  - Google
  - GitHub
  - Twitter/X
  - Discord
  - その他主要OAuthプロバイダー
- JWTトークンベースの認証
- ロールベースのアクセス制御（RBAC）

### 7. Push通知
- Web Push / FCMを使用したプッシュ通知
- トピックベースの通知配信
- スケジュール通知
- 通知テンプレート機能

### 8. ワンクリックデプロイ
- GitHub ActionsまたはDeploy Buttonによる自動デプロイ
- 環境変数の自動設定
- Cloudflareアカウントとの連携

## 技術スタック

- **言語**: TypeScript
- **ランタイム**: Cloudflare Workers
- **フレームワーク**: Hono
- **データベース**: Cloudflare D1 (SQLite)
- **ストレージ**: Cloudflare R2
- **認証**: Hono OAuth Providers Middleware
- **フロントエンド**: Preact + Vite（管理ダッシュボード用）
- **アセット配信**: Cloudflare Workers Assets
- **ビルドツール**: Wrangler, Vite
- **テスト**: Vitest, Miniflare

## プロジェクト構造

```
vibebase/
├── packages/
│   ├── core/              # コアライブラリ（Cloudflare Workers）
│   ├── dashboard/         # 管理ダッシュボード（Preact + Vite）
│   ├── sdk/              # クライアントSDK
│   └── cli/              # CLIツール
├── examples/             # サンプルアプリケーション
├── docs/                 # ドキュメント
└── deploy/              # デプロイメント設定
```

## ロードマップ

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
- [ ] OAuth認証実装
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

## 開発方針

### リファクタリングの方針
1. **継続的なリファクタリング**: コードベースの品質と保守性を向上させるため、適宜リファクタリングを実施する
2. **テスト駆動リファクタリング**: リファクタリング前には必ず十分なテストを追加し、動作が変わらないことを保証する

### テスト戦略
- リファクタリング対象の機能に対して包括的なテストを作成
- リファクタリング前後でテストが通ることを確認
- 外部から見た動作が変わらないことを保証

## ライセンス

Elastic License 2.0

## コントリビューション

プロジェクトへの貢献を歓迎します！詳細はCONTRIBUTING.mdをご確認ください。