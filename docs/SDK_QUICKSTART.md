# Vibebase SDK クイックスタートガイド

このガイドでは、Vibebase SDK（TypeScript SDK および React SDK）を使って、最短でアプリケーションを構築する方法を説明します。

## 📋 前提条件

- Node.js 18以上
- TypeScript 4.5以上（TypeScript SDKを使用する場合）
- React 16.8以上（React SDKを使用する場合）
- Vibebaseインスタンスのデプロイ済み

## 🚀 インストール

### TypeScript SDK

```bash
npm install @vibebase/sdk
# または
yarn add @vibebase/sdk
# または
pnpm add @vibebase/sdk
```

### React SDK

```bash
npm install @vibebase/react @vibebase/sdk
# または
yarn add @vibebase/react @vibebase/sdk
# または
pnpm add @vibebase/react @vibebase/sdk
```

## 🔑 認証設定

### 1. 管理者認証（JWT）

Vibebaseダッシュボードでユーザー認証を行い、JWTトークンを取得します。

```typescript
import { VibebaseClient } from '@vibebase/sdk'

const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev'
})

// JWTトークンを設定
client.setUserToken('your-jwt-token')
```

### 2. APIキー認証

VibebaseダッシュボードでAPIキーを生成し、プログラマティックアクセスに使用します。

```typescript
const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev'
})

// APIキーを設定
client.setApiKey('your-api-key')
```

## 🏗️ プロジェクトセットアップ

### TypeScript プロジェクト

#### 1. プロジェクトの初期化

```bash
mkdir my-vibebase-app
cd my-vibebase-app
npm init -y
npm install @vibebase/sdk typescript @types/node
npx tsc --init
```

#### 2. 基本的なセットアップ

```typescript
// src/app.ts
import { VibebaseClient } from '@vibebase/sdk'

const client = new VibebaseClient({
  apiUrl: process.env.VIBEBASE_API_URL || 'https://your-app.your-subdomain.workers.dev'
})

// 環境変数からAPIキーを設定
if (process.env.VIBEBASE_API_KEY) {
  client.setApiKey(process.env.VIBEBASE_API_KEY)
}

export { client }
```

#### 3. 環境変数設定

```bash
# .env
VIBEBASE_API_URL=https://your-app.your-subdomain.workers.dev
VIBEBASE_API_KEY=your-api-key
```

### React プロジェクト

#### 1. Create React App での設定

```bash
npx create-react-app my-vibebase-react-app --template typescript
cd my-vibebase-react-app
npm install @vibebase/react @vibebase/sdk
```

#### 2. プロバイダーの設定

```tsx
// src/App.tsx
import React from 'react'
import { VibebaseProvider } from '@vibebase/react'
import Dashboard from './components/Dashboard'

function App() {
  return (
    <VibebaseProvider
      config={{
        apiUrl: process.env.REACT_APP_VIBEBASE_API_URL || 'https://your-app.your-subdomain.workers.dev'
      }}
    >
      <div className="App">
        <Dashboard />
      </div>
    </VibebaseProvider>
  )
}

export default App
```

#### 3. 環境変数設定

```bash
# .env.local
REACT_APP_VIBEBASE_API_URL=https://your-app.your-subdomain.workers.dev
```

#### 4. Next.js での設定

```tsx
// pages/_app.tsx
import type { AppProps } from 'next/app'
import { VibebaseProvider } from '@vibebase/react'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <VibebaseProvider
      config={{
        apiUrl: process.env.NEXT_PUBLIC_VIBEBASE_API_URL!
      }}
    >
      <Component {...pageProps} />
    </VibebaseProvider>
  )
}
```

```bash
# .env.local
NEXT_PUBLIC_VIBEBASE_API_URL=https://your-app.your-subdomain.workers.dev
```

## 📱 最初のアプリケーション：シンプルなTodoアプリ

### TypeScript 版

```typescript
// src/todo-service.ts
import { client } from './app'

interface Todo {
  id: string
  title: string
  completed: boolean
  created_at: string
  updated_at: string
}

export class TodoService {
  async createTodo(title: string): Promise<Todo> {
    const response = await client.data.create<Todo>('todos', {
      title,
      completed: false
    })

    if (!response.success) {
      throw new Error(response.error || 'Failed to create todo')
    }

    return response.data!
  }

  async getTodos(): Promise<Todo[]> {
    const response = await client.data.list<Todo>('todos', {
      orderBy: 'created_at',
      orderDirection: 'desc'
    })

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch todos')
    }

    return response.data.data
  }

  async updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    const response = await client.data.update<Todo>('todos', id, updates)

    if (!response.success) {
      throw new Error(response.error || 'Failed to update todo')
    }

    return response.data!
  }

  async deleteTodo(id: string): Promise<void> {
    const response = await client.data.delete('todos', id)

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete todo')
    }
  }
}

// 使用例
async function main() {
  const todoService = new TodoService()

  try {
    // Todo作成
    const newTodo = await todoService.createTodo('Vibebase SDKを学ぶ')
    console.log('作成されたTodo:', newTodo)

    // Todo一覧取得
    const todos = await todoService.getTodos()
    console.log('Todo一覧:', todos)

    // Todo完了
    const updatedTodo = await todoService.updateTodo(newTodo.id, {
      completed: true
    })
    console.log('更新されたTodo:', updatedTodo)

  } catch (error) {
    console.error('エラー:', error)
  }
}

main()
```

### React 版

```tsx
// src/components/TodoApp.tsx
import React, { useState } from 'react'
import { useData, useAuth } from '@vibebase/react'

interface Todo {
  id: string
  title: string
  completed: boolean
  user_id: string
  created_at: string
  updated_at: string
}

export default function TodoApp() {
  const { user, isAuthenticated, login } = useAuth()
  const [newTodoTitle, setNewTodoTitle] = useState('')

  const {
    data: todos,
    isLoading,
    error,
    create,
    update,
    delete: deleteTodo,
    isCreating
  } = useData<Todo>('todos', {
    realtimeEnabled: true
  })

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h1>Vibebase Todo App</h1>
        <button 
          onClick={() => login('github')}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          GitHubでログイン
        </button>
      </div>
    )
  }

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoTitle.trim()) return

    try {
      await create({
        title: newTodoTitle.trim(),
        completed: false,
        user_id: user!.id
      })
      setNewTodoTitle('')
    } catch (error) {
      alert('Todo作成に失敗しました')
    }
  }

  const handleToggleTodo = async (todo: Todo) => {
    try {
      await update(todo.id, {
        completed: !todo.completed
      })
    } catch (error) {
      alert('Todo更新に失敗しました')
    }
  }

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteTodo(todoId)
    } catch (error) {
      alert('Todo削除に失敗しました')
    }
  }

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>読み込み中...</div>
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
      エラー: {error.message}
    </div>
  }

  const completedCount = todos.filter(todo => todo.completed).length

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1>Todo App</h1>
        <p>ようこそ、{user?.username}さん！</p>
        <p>完了: {completedCount} / {todos.length}</p>
      </header>

      <form onSubmit={handleAddTodo} style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="新しいTodoを入力..."
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              fontSize: '16px'
            }}
          />
          <button
            type="submit"
            disabled={isCreating}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            {isCreating ? '追加中...' : '追加'}
          </button>
        </div>
      </form>

      <div>
        {todos.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px', 
            color: '#666',
            backgroundColor: '#f8f9fa',
            borderRadius: '5px'
          }}>
            まだTodoがありません。上記から追加してください。
          </div>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '15px',
                margin: '10px 0',
                backgroundColor: todo.completed ? '#f8f9fa' : 'white',
                border: '1px solid #ddd',
                borderRadius: '5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleTodo(todo)}
                style={{ marginRight: '15px', transform: 'scale(1.2)' }}
              />
              
              <span
                style={{
                  flex: 1,
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  color: todo.completed ? '#666' : 'black',
                  fontSize: '16px'
                }}
              >
                {todo.title}
              </span>
              
              <small style={{ marginRight: '15px', color: '#666' }}>
                {new Date(todo.created_at).toLocaleDateString()}
              </small>
              
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                削除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

```tsx
// src/components/Dashboard.tsx
import React from 'react'
import TodoApp from './TodoApp'

export default function Dashboard() {
  return (
    <div>
      <TodoApp />
    </div>
  )
}
```

## 🗄️ データベース スキーマの設定

Vibebaseダッシュボードで以下のテーブルを作成します：

### todos テーブル

```sql
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックスの作成
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_created_at ON todos(created_at);
```

### テーブルポリシーの設定

1. ダッシュボードの「データベース」セクションで`todos`テーブルを選択
2. 「ポリシー」タブで以下を設定：
   - **アクセスレベル**: `private`（所有者のみアクセス可能）
   - **所有者カラム**: `user_id`

これにより、各ユーザーは自分のTodoのみアクセスできます。

## ⚡ リアルタイム機能の追加

### フックの設定

Vibebaseダッシュボードの「リアルタイム」セクションで：

1. 新しいフックを作成
2. **テーブル**: `todos`
3. **イベント**: `*`（全てのイベント）
4. **有効化**をチェック

これで、TodoアプリでリアルタイムUPが動作します。

## 🎨 スタイリングの追加

### CSS ファイルの作成

```css
/* src/styles/TodoApp.css */
.todo-app {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.todo-header {
  text-align: center;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 10px;
}

.todo-progress {
  width: 100%;
  height: 8px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  margin: 10px 0;
  overflow: hidden;
}

.todo-progress-fill {
  height: 100%;
  background-color: white;
  transition: width 0.3s ease;
}

.todo-form {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
}

.todo-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s ease;
}

.todo-input:focus {
  outline: none;
  border-color: #667eea;
}

.todo-add-button {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.todo-add-button:hover {
  transform: translateY(-1px);
}

.todo-add-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.todo-list {
  list-style: none;
  padding: 0;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 15px;
  margin: 10px 0;
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.todo-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.todo-item.completed {
  background-color: #f8f9fa;
  opacity: 0.8;
}

.todo-checkbox {
  margin-right: 15px;
  transform: scale(1.2);
  cursor: pointer;
}

.todo-text {
  flex: 1;
  font-size: 16px;
  transition: all 0.2s ease;
}

.todo-text.completed {
  text-decoration: line-through;
  color: #6c757d;
}

.todo-date {
  font-size: 12px;
  color: #6c757d;
  margin-right: 15px;
}

.todo-delete-button {
  padding: 6px 12px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.todo-delete-button:hover {
  background-color: #c82333;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

.loading, .error {
  text-align: center;
  padding: 50px;
  font-size: 18px;
}

.error {
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
}

@media (max-width: 600px) {
  .todo-app {
    padding: 10px;
  }
  
  .todo-form {
    flex-direction: column;
  }
  
  .todo-item {
    flex-wrap: wrap;
    gap: 10px;
  }
}
```

### CSS の適用

```tsx
// src/components/TodoApp.tsx (スタイル適用版)
import React, { useState } from 'react'
import { useData, useAuth } from '@vibebase/react'
import '../styles/TodoApp.css'

// コンポーネントのJSXでCSSクラスを使用
<div className="todo-app">
  <header className="todo-header">
    <h1>Todo App</h1>
    <p>ようこそ、{user?.username}さん！</p>
    <div className="todo-progress">
      <div 
        className="todo-progress-fill"
        style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
      />
    </div>
    <p>完了: {completedCount} / {totalCount}</p>
  </header>
  
  {/* 残りのJSX... */}
</div>
```

## 🚀 デプロイ

### Vercel でのデプロイ（React アプリ）

```bash
# Vercel CLI のインストール
npm i -g vercel

# デプロイ
vercel

# 環境変数の設定
vercel env add NEXT_PUBLIC_VIBEBASE_API_URL
```

### Netlify でのデプロイ

```bash
# ビルド
npm run build

# netlify-cli のインストール
npm i -g netlify-cli

# デプロイ
netlify deploy --prod --dir=build
```

## 🎯 次のステップ

1. **追加機能の実装**
   - ファイルアップロード機能
   - ユーザープロフィール編集
   - カスタムSQL クエリ

2. **パフォーマンス最適化**
   - コードスプリッティング
   - 画像最適化
   - キャッシュ戦略

3. **セキュリティ強化**
   -入力バリデーション
   - CSRFプロテクション
   - セキュアなファイルアップロード

4. **本格的なアプリケーション開発**
   - [TypeScript SDK 詳細ドキュメント](./SDK_TYPESCRIPT.md)
   - [React SDK 詳細ドキュメント](./SDK_REACT.md)

## 💡 ヒントとトラブルシューティング

### よくある問題

1. **認証エラー**
   ```typescript
   // JWTトークンの期限切れ
   if (response.error === 'Token expired') {
     // リフレッシュトークンを使用
     await client.auth.refreshToken(refreshToken)
   }
   ```

2. **ネットワークエラー**
   ```typescript
   // リトライ機能付きのリクエスト
   const clientWithRetry = new VibebaseClient({
     apiUrl: 'your-api-url',
     retries: 3,
     timeout: 10000
   })
   ```

3. **リアルタイム接続エラー**
   ```typescript
   // 接続状態の監視
   useRealtime({
     onError: (error) => {
       console.error('リアルタイム接続エラー:', error)
       // 再接続ロジック
     }
   })
   ```

### パフォーマンス tips

1. **データの効率的な取得**
   ```typescript
   // ページネーションを使用
   const { data } = useData('posts', {
     limit: 20,
     offset: page * 20
   })
   ```

2. **不要な再レンダリングの防止**
   ```tsx
   // React.memo でコンポーネントをメモ化
   const TodoItem = React.memo(({ todo, onToggle, onDelete }) => {
     // コンポーネント実装
   })
   ```

おめでとうございます！これでVibebase SDKを使った最初のアプリケーションが完成しました。さらに詳しい機能については、各SDKの詳細ドキュメントを参照してください。