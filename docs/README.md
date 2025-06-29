# Vibebase SDK ドキュメント 📚

Vibebase SDKへようこそ！このディレクトリには、TypeScript SDK および React SDK の包括的なドキュメントが含まれています。

## 📁 ドキュメント構成

| ファイル | 内容 | 対象者 |
|---------|------|--------|
| [SDK_QUICKSTART.md](./SDK_QUICKSTART.md) | 🚀 クイックスタートガイド | 初めての方 |
| [SDK_TYPESCRIPT.md](./SDK_TYPESCRIPT.md) | 📘 TypeScript SDK 詳細ガイド | JS/TS開発者 |
| [SDK_REACT.md](./SDK_REACT.md) | ⚛️ React SDK 詳細ガイド | React開発者 |
| [SDK_API_REFERENCE.md](./SDK_API_REFERENCE.md) | 📖 完全APIリファレンス | 全開発者 |

## 🎯 どこから始めるべきか？

### 🆕 初めてVibebase SDKを使用する場合

1. **[クイックスタートガイド](./SDK_QUICKSTART.md)** から始めてください
   - インストール手順
   - 基本セットアップ
   - 最初のTodoアプリ作成
   - データベース設定

### 🔧 TypeScript/JavaScript で開発する場合

1. **[TypeScript SDK ガイド](./SDK_TYPESCRIPT.md)** をお読みください
   - 全機能の詳細説明
   - 実用的なサンプルコード
   - ベストプラクティス
   - 高度な使用例

### ⚛️ React で開発する場合

1. **[React SDK ガイド](./SDK_REACT.md)** をお読みください
   - React Hooks の使い方
   - コンポーネント例
   - 状態管理
   - リアルタイム機能

### 📚 詳細なAPI仕様を確認したい場合

1. **[API リファレンス](./SDK_API_REFERENCE.md)** をご参照ください
   - 全APIの詳細仕様
   - パラメータとレスポンス
   - 型定義
   - エラーハンドリング

## 🛠️ SDK 概要

### TypeScript SDK (`@vibebase/sdk`)

```bash
npm install @vibebase/sdk
```

- **対象**: JavaScript/TypeScript プロジェクト全般
- **特徴**: シンプルなAPIクライアント
- **用途**: Node.js、Vanilla JS、Vue.js、Svelte など

### React SDK (`@vibebase/react`)

```bash
npm install @vibebase/react @vibebase/sdk
```

- **対象**: React アプリケーション
- **特徴**: React Hooks API
- **用途**: React、Next.js、Create React App など

## 🔧 主要機能

### ✅ 認証機能
- GitHub OAuth認証
- JWT トークン管理
- API キー認証
- 自動トークンリフレッシュ

### ✅ データベース操作
- 型安全なCRUD操作
- 検索・フィルタリング
- ページネーション
- RBACアクセス制御

### ✅ ストレージ機能
- ファイルアップロード/ダウンロード
- プログレストラッキング
- プリサインURL生成
- 複数ファイル対応

### ✅ リアルタイム機能
- Server-Sent Events (SSE)
- データ変更監視
- 自動UI更新
- イベントフック

### ✅ カスタムSQL
- パラメーター付きクエリ
- キャッシュ機能
- レポート生成
- 複雑な集計処理

### ✅ ユーザー管理
- エンドユーザーCRUD
- プロフィール管理
- アクティビティ追跡

## 🎨 サンプルアプリケーション

### シンプルなTodoアプリ

```tsx
import { useData, useAuth } from '@vibebase/react'

function TodoApp() {
  const { user, login } = useAuth()
  const { data: todos, create, update } = useData('todos', {
    realtimeEnabled: true
  })

  if (!user) {
    return <button onClick={() => login('github')}>ログイン</button>
  }

  return (
    <div>
      <h1>Welcome, {user.username}!</h1>
      {todos.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox" 
            checked={todo.completed}
            onChange={() => update(todo.id, { completed: !todo.completed })}
          />
          {todo.title}
        </div>
      ))}
    </div>
  )
}
```

### リアルタイムチャット

```tsx
import { useRealtimeSubscription } from '@vibebase/react'

function Chat() {
  const [messages, setMessages] = useState([])

  useRealtimeSubscription('messages', 'insert', (event) => {
    setMessages(prev => [event.data, ...prev])
  })

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
    </div>
  )
}
```

## 🎯 学習パス

### 初級者向け
1. [クイックスタート](./SDK_QUICKSTART.md) でTodoアプリを作成
2. [TypeScript SDK](./SDK_TYPESCRIPT.md) の基本機能を学習
3. 認証とデータ操作をマスター

### 中級者向け
1. [React SDK](./SDK_REACT.md) でより複雑なUIを構築
2. リアルタイム機能を活用
3. ファイルアップロード機能を実装

### 上級者向け
1. カスタムSQLでレポート機能を作成
2. [API リファレンス](./SDK_API_REFERENCE.md) で全機能を活用
3. パフォーマンス最適化とセキュリティ強化

## 💡 よくある質問

### Q: TypeScript SDK と React SDK の違いは？

**A:** TypeScript SDK は汎用的なAPIクライアントで、React SDK はReact専用のHooks APIを提供します。React SDK は内部でTypeScript SDK を使用しています。

### Q: 認証方法はどれを選ぶべき？

**A:** 
- **エンドユーザー**: GitHub OAuth（JWT）
- **サーバー/CLI**: API キー
- **開発・テスト**: どちらでも可

### Q: リアルタイム機能は必須？

**A:** いいえ、オプショナルです。`realtimeEnabled: true` で有効化できます。

### Q: ファイルアップロードの制限は？

**A:** Cloudflare Workers の制限に従います（通常100MB）。

## 🔗 関連リンク

- [Vibebase 公式ドキュメント](https://github.com/vibebase/vibebase)
- [GitHub リポジトリ](https://github.com/vibebase/vibebase)
- [Issues・質問](https://github.com/vibebase/vibebase/issues)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)

## 📧 サポート

質問や問題がある場合は：

1. まず [API リファレンス](./SDK_API_REFERENCE.md) で解決方法を確認
2. [GitHub Issues](https://github.com/vibebase/vibebase/issues) で検索
3. 新しいIssueを作成

---

**Happy Coding with Vibebase! 🚀**