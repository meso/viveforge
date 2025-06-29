# Vibebase React SDK ドキュメント

Vibebase React SDKは、ReactアプリケーションでVibebase BaaSを簡単に利用するためのライブラリです。React Hooks APIを提供し、状態管理、リアルタイム更新、認証などの機能を直感的に使用できます。

## 📦 インストール

```bash
npm install @vibebase/react @vibebase/sdk
# または
yarn add @vibebase/react @vibebase/sdk
# または
pnpm add @vibebase/react @vibebase/sdk
```

## 🚀 基本セットアップ

### プロバイダーの設定

```tsx
import React from 'react'
import { VibebaseProvider } from '@vibebase/react'

function App() {
  return (
    <VibebaseProvider 
      config={{
        apiUrl: 'https://your-app.your-subdomain.workers.dev'
      }}
    >
      <Dashboard />
    </VibebaseProvider>
  )
}

export default App
```

### カスタムクライアントの使用

```tsx
import { VibebaseClient } from '@vibebase/sdk'
import { VibebaseProvider } from '@vibebase/react'

const customClient = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev',
  timeout: 10000
})

function App() {
  return (
    <VibebaseProvider client={customClient}>
      <Dashboard />
    </VibebaseProvider>
  )
}
```

## 🔐 認証機能

### useAuth Hook

```tsx
import React from 'react'
import { useAuth } from '@vibebase/react'

function AuthComponent() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    logout, 
    setUserToken, 
    setApiKey 
  } = useAuth()

  const handleLogin = async () => {
    try {
      await login('github', 'https://your-app.com/callback')
    } catch (error) {
      console.error('ログインエラー:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('ログアウトエラー:', error)
    }
  }

  if (isLoading) {
    return <div>認証状態を確認中...</div>
  }

  if (error) {
    return <div>認証エラー: {error.message}</div>
  }

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <h2>Welcome, {user?.username}!</h2>
          <img src={user?.avatar_url} alt="Avatar" />
          <button onClick={handleLogout}>ログアウト</button>
        </div>
      ) : (
        <div>
          <button onClick={handleLogin}>GitHubでログイン</button>
        </div>
      )}
    </div>
  )
}
```

### JWT トークンの設定

```tsx
import React, { useEffect } from 'react'
import { useAuth } from '@vibebase/react'

function TokenHandler() {
  const { setUserToken } = useAuth()

  useEffect(() => {
    // URLパラメータからトークンを取得
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    
    if (token) {
      setUserToken(token)
      // URLを綺麗にする
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [setUserToken])

  return null
}
```

## 🗄️ データ操作

### useData Hook

```tsx
import React from 'react'
import { useData } from '@vibebase/react'

interface User {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

function UserList() {
  const { 
    data: users, 
    total, 
    error, 
    isLoading, 
    refetch, 
    create, 
    update, 
    delete: deleteUser,
    isCreating,
    isUpdating,
    isDeleting
  } = useData<User>('users', {
    limit: 10,
    orderBy: 'created_at',
    orderDirection: 'desc',
    realtimeEnabled: true // リアルタイム更新を有効化
  })

  const handleCreateUser = async () => {
    try {
      await create({
        name: '新しいユーザー',
        email: 'new@example.com'
      })
    } catch (error) {
      console.error('ユーザー作成エラー:', error)
    }
  }

  const handleUpdateUser = async (userId: string) => {
    try {
      await update(userId, {
        name: '更新されたユーザー'
      })
    } catch (error) {
      console.error('ユーザー更新エラー:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId)
    } catch (error) {
      console.error('ユーザー削除エラー:', error)
    }
  }

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      <h2>ユーザー一覧 (総件数: {total})</h2>
      
      <button 
        onClick={handleCreateUser} 
        disabled={isCreating}
      >
        {isCreating ? '作成中...' : 'ユーザー作成'}
      </button>
      
      <button onClick={refetch}>更新</button>

      <ul>
        {users.map((user) => (
          <li key={user.id}>
            <strong>{user.name}</strong> ({user.email})
            <button 
              onClick={() => handleUpdateUser(user.id)}
              disabled={isUpdating}
            >
              {isUpdating ? '更新中...' : '編集'}
            </button>
            <button 
              onClick={() => handleDeleteUser(user.id)}
              disabled={isDeleting}
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### useQuery Hook

```tsx
import React from 'react'
import { useQuery } from '@vibebase/react'
import { useVibebase } from '@vibebase/react'

function ProductDetails({ productId }: { productId: string }) {
  const { client } = useVibebase()
  
  const { 
    data: product, 
    error, 
    isLoading, 
    isRefetching, 
    refetch 
  } = useQuery(
    async () => {
      const response = await client.data.get('products', productId)
      if (!response.success) {
        throw new Error(response.error || 'Product not found')
      }
      return response.data
    },
    {
      enabled: !!productId, // productIdがある場合のみクエリ実行
      refetchOnWindowFocus: true, // ウィンドウフォーカス時に再取得
      retry: 3, // エラー時のリトライ回数
      onSuccess: (data) => {
        console.log('商品データ取得成功:', data)
      },
      onError: (error) => {
        console.error('商品データ取得エラー:', error)
      }
    }
  )

  if (isLoading) return <div>商品情報を読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>
  if (!product) return <div>商品が見つかりません</div>

  return (
    <div>
      <h2>{product.name}</h2>
      <p>価格: ¥{product.price}</p>
      <p>在庫: {product.stock}個</p>
      
      <button onClick={refetch} disabled={isRefetching}>
        {isRefetching ? '更新中...' : '情報を更新'}
      </button>
    </div>
  )
}
```

### useMutation Hook

```tsx
import React, { useState } from 'react'
import { useMutation } from '@vibebase/react'
import { useVibebase } from '@vibebase/react'

function CreatePostForm() {
  const { client } = useVibebase()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const createPostMutation = useMutation(
    async (postData: { title: string; content: string }) => {
      const response = await client.data.create('posts', postData)
      if (!response.success) {
        throw new Error(response.error || 'Failed to create post')
      }
      return response.data
    },
    {
      onSuccess: (data) => {
        console.log('投稿作成成功:', data)
        setTitle('')
        setContent('')
        // リダイレクトやリスト更新など
      },
      onError: (error) => {
        console.error('投稿作成エラー:', error)
        alert(`エラー: ${error.message}`)
      }
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createPostMutation.mutate({ title, content })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>タイトル:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      
      <div>
        <label>内容:</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </div>
      
      <button 
        type="submit" 
        disabled={createPostMutation.isLoading}
      >
        {createPostMutation.isLoading ? '投稿中...' : '投稿する'}
      </button>
      
      {createPostMutation.error && (
        <div style={{ color: 'red' }}>
          エラー: {createPostMutation.error.message}
        </div>
      )}
    </form>
  )
}
```

### useInfiniteQuery Hook

```tsx
import React from 'react'
import { useInfiniteQuery } from '@vibebase/react'
import { useVibebase } from '@vibebase/react'

function InfinitePostList() {
  const { client } = useVibebase()

  const {
    data: posts,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    error
  } = useInfiniteQuery(
    async (pageParam = 0) => {
      const response = await client.data.list('posts', {
        limit: 10,
        offset: pageParam * 10,
        orderBy: 'created_at',
        orderDirection: 'desc'
      })
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch posts')
      }
      
      return response.data
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        const currentOffset = allPages.length * 10
        return lastPage.data.length === 10 ? allPages.length : undefined
      }
    }
  )

  if (isLoading) return <div>投稿を読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      <h2>投稿一覧</h2>
      
      {posts.map((post) => (
        <div key={post.id} style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
          <small>作成日: {new Date(post.created_at).toLocaleDateString()}</small>
        </div>
      ))}
      
      {hasNextPage && (
        <button 
          onClick={fetchNextPage} 
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? '読み込み中...' : 'もっと読み込む'}
        </button>
      )}
    </div>
  )
}
```

## 📁 ストレージ機能

### useStorage Hook

```tsx
import React from 'react'
import { useStorage } from '@vibebase/react'

function FileManager() {
  const {
    upload,
    getDownloadUrl,
    getInfo,
    delete: deleteFile,
    list,
    isUploading,
    isDeleting,
    error
  } = useStorage()

  const [files, setFiles] = React.useState<any[]>([])

  // ファイル一覧を取得
  React.useEffect(() => {
    const loadFiles = async () => {
      try {
        const fileList = await list()
        setFiles(fileList)
      } catch (error) {
        console.error('ファイル一覧取得エラー:', error)
      }
    }
    
    loadFiles()
  }, [list])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await upload(file, undefined, {
        makePublic: true
      })
      console.log('アップロード完了:', result)
      
      // ファイル一覧を更新
      const updatedFiles = await list()
      setFiles(updatedFiles)
    } catch (error) {
      console.error('アップロードエラー:', error)
    }
  }

  const handleDownload = async (fileName: string) => {
    try {
      const downloadUrl = await getDownloadUrl(fileName, 3600) // 1時間有効
      window.open(downloadUrl, '_blank')
    } catch (error) {
      console.error('ダウンロードエラー:', error)
    }
  }

  const handleDelete = async (fileName: string) => {
    try {
      await deleteFile(fileName)
      
      // ファイル一覧を更新
      const updatedFiles = await list()
      setFiles(updatedFiles)
    } catch (error) {
      console.error('削除エラー:', error)
    }
  }

  return (
    <div>
      <h2>ファイル管理</h2>
      
      <div>
        <input 
          type="file" 
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        {isUploading && <span>アップロード中...</span>}
      </div>

      {error && (
        <div style={{ color: 'red' }}>
          エラー: {error.message}
        </div>
      )}

      <div>
        <h3>ファイル一覧</h3>
        {files.map((file) => (
          <div key={file.fileName} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc' }}>
            <strong>{file.fileName}</strong> ({file.size} bytes)
            <br />
            <button onClick={() => handleDownload(file.fileName)}>
              ダウンロード
            </button>
            <button 
              onClick={() => handleDelete(file.fileName)}
              disabled={isDeleting}
            >
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### useFileUpload Hook

```tsx
import React from 'react'
import { useFileUpload } from '@vibebase/react'

function ImageUploader() {
  const {
    upload,
    uploadMultiple,
    isUploading,
    progress,
    error,
    reset
  } = useFileUpload()

  const handleSingleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await upload(file, `images/${Date.now()}-${file.name}`, {
        makePublic: true,
        contentType: file.type
      })
      
      console.log('画像アップロード完了:', result)
      alert('画像がアップロードされました！')
    } catch (error) {
      console.error('アップロードエラー:', error)
    }
  }

  const handleMultipleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    try {
      const results = await uploadMultiple(files, {
        makePublic: true
      })
      
      console.log('複数ファイルアップロード完了:', results)
      alert(`${results.length}個のファイルがアップロードされました！`)
    } catch (error) {
      console.error('複数アップロードエラー:', error)
    }
  }

  return (
    <div>
      <h2>画像アップローダー</h2>
      
      <div>
        <h3>単一ファイル</h3>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleSingleUpload}
          disabled={isUploading}
        />
      </div>

      <div>
        <h3>複数ファイル</h3>
        <input 
          type="file" 
          multiple
          accept="image/*"
          onChange={handleMultipleUpload}
          disabled={isUploading}
        />
      </div>

      {isUploading && (
        <div>
          <p>アップロード中...</p>
          {progress && (
            <div>
              <div style={{ 
                width: '200px', 
                height: '20px', 
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc'
              }}>
                <div style={{
                  width: `${progress.percentage}%`,
                  height: '100%',
                  backgroundColor: '#4caf50'
                }} />
              </div>
              <p>{progress.percentage}% ({progress.loaded} / {progress.total} bytes)</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ color: 'red' }}>
          エラー: {error.message}
          <button onClick={reset}>リセット</button>
        </div>
      )}
    </div>
  )
}
```

## ⚡ リアルタイム機能

### useRealtime Hook

```tsx
import React from 'react'
import { useRealtime } from '@vibebase/react'

function RealtimeStatus() {
  const { 
    isConnected, 
    subscribe, 
    unsubscribeAll 
  } = useRealtime({
    enabled: true,
    onConnect: () => console.log('リアルタイム接続完了'),
    onDisconnect: () => console.log('リアルタイム接続切断'),
    onError: (error) => console.error('リアルタイム接続エラー:', error)
  })

  const [messages, setMessages] = React.useState<any[]>([])

  React.useEffect(() => {
    if (!isConnected) return

    // チャットメッセージの監視
    const unsubscribe = subscribe('messages', 'insert', (event) => {
      console.log('新しいメッセージ:', event)
      setMessages(prev => [event.data, ...prev])
    })

    return () => {
      unsubscribe()
    }
  }, [isConnected, subscribe])

  React.useEffect(() => {
    // コンポーネントのクリーンアップ
    return () => {
      unsubscribeAll()
    }
  }, [unsubscribeAll])

  return (
    <div>
      <h2>リアルタイムチャット</h2>
      <p>接続状態: {isConnected ? '🟢 接続中' : '🔴 切断中'}</p>
      
      <div>
        <h3>メッセージ</h3>
        {messages.map((message, index) => (
          <div key={index} style={{ 
            padding: '10px', 
            margin: '5px 0', 
            backgroundColor: '#f5f5f5',
            borderRadius: '5px'
          }}>
            <strong>{message.username}:</strong> {message.content}
            <br />
            <small>{new Date(message.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### useRealtimeSubscription Hook

```tsx
import React from 'react'
import { useRealtimeSubscription } from '@vibebase/react'

function UserActivityMonitor() {
  const [activities, setActivities] = React.useState<any[]>([])

  // ユーザーアクティビティをリアルタイムで監視
  useRealtimeSubscription(
    'user_activities',
    '*', // 全てのイベント（insert, update, delete）
    (event) => {
      console.log('ユーザーアクティビティ:', event)
      
      setActivities(prev => [
        {
          ...event.data,
          eventType: event.eventType,
          timestamp: new Date().toISOString()
        },
        ...prev.slice(0, 49) // 最新50件を保持
      ])
    },
    {
      enabled: true // 自動的に監視を開始
    }
  )

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'insert': return '✅'
      case 'update': return '✏️'
      case 'delete': return '❌'
      default: return '📝'
    }
  }

  return (
    <div>
      <h2>ユーザーアクティビティ監視</h2>
      
      <div style={{ height: '400px', overflowY: 'auto' }}>
        {activities.map((activity, index) => (
          <div key={index} style={{
            padding: '8px',
            margin: '4px 0',
            backgroundColor: '#f8f9fa',
            borderLeft: '4px solid #007bff',
            borderRadius: '4px'
          }}>
            <span>{getEventIcon(activity.eventType)}</span>
            <strong> {activity.eventType}</strong>
            <br />
            ユーザー: {activity.user_id}
            <br />
            アクション: {activity.action}
            <br />
            <small>{new Date(activity.timestamp).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## 📊 カスタムSQL機能

### useCustomQuery Hook

```tsx
import React, { useState } from 'react'
import { useCustomQuery } from '@vibebase/react'

interface SalesReport {
  month: string
  total_sales: number
  order_count: number
  avg_order_value: number
}

function SalesReportDashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [category, setCategory] = useState('all')

  const {
    data: salesData,
    error,
    isLoading,
    execute,
    isExecuting
  } = useCustomQuery<SalesReport>('monthly-sales-report')

  const handleGenerateReport = async () => {
    try {
      await execute({
        year,
        category: category === 'all' ? undefined : category
      })
    } catch (error) {
      console.error('レポート生成エラー:', error)
    }
  }

  return (
    <div>
      <h2>売上レポート</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          年:
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
            min="2020"
            max="2030"
          />
        </label>
        
        <label style={{ marginLeft: '20px' }}>
          カテゴリ:
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">全て</option>
            <option value="electronics">電子機器</option>
            <option value="clothing">衣類</option>
            <option value="books">書籍</option>
          </select>
        </label>
        
        <button 
          onClick={handleGenerateReport}
          disabled={isLoading || isExecuting}
          style={{ marginLeft: '20px' }}
        >
          {isExecuting ? 'レポート生成中...' : 'レポート生成'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          エラー: {error.message}
        </div>
      )}

      {isLoading && <div>初期データ読み込み中...</div>}

      {salesData.length > 0 && (
        <div>
          <h3>{year}年の売上レポート</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>月</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>総売上</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>注文数</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>平均注文額</th>
              </tr>
            </thead>
            <tbody>
              {salesData.map((row) => (
                <tr key={row.month}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{row.month}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    ¥{row.total_sales.toLocaleString()}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    {row.order_count}
                  </td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                    ¥{row.avg_order_value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

## 👤 ユーザー管理

### useUser Hook

```tsx
import React, { useState } from 'react'
import { useUser } from '@vibebase/react'

function UserManagement() {
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  
  const {
    users,
    user: selectedUser,
    isLoading,
    error,
    list,
    get,
    create,
    update,
    delete: deleteUser,
    isCreating,
    isUpdating,
    isDeleting
  } = useUser()

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    github_id: ''
  })

  // コンポーネントマウント時にユーザー一覧を取得
  React.useEffect(() => {
    list()
  }, [list])

  // 選択されたユーザーの詳細を取得
  React.useEffect(() => {
    if (selectedUserId) {
      get(selectedUserId)
    }
  }, [selectedUserId, get])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await create(newUser)
      setNewUser({ username: '', email: '', github_id: '' })
      // ユーザー一覧を再取得
      list()
    } catch (error) {
      console.error('ユーザー作成エラー:', error)
    }
  }

  const handleUpdateUser = async (userId: string, updates: any) => {
    try {
      await update(userId, updates)
      // 詳細表示を更新
      if (selectedUserId === userId) {
        get(userId)
      }
      // ユーザー一覧を再取得
      list()
    } catch (error) {
      console.error('ユーザー更新エラー:', error)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('このユーザーを削除しますか？')) return
    
    try {
      await deleteUser(userId)
      if (selectedUserId === userId) {
        setSelectedUserId('')
      }
      // ユーザー一覧を再取得
      list()
    } catch (error) {
      console.error('ユーザー削除エラー:', error)
    }
  }

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      {/* ユーザー一覧 */}
      <div style={{ flex: 1 }}>
        <h2>ユーザー一覧</h2>
        
        {/* 新規作成フォーム */}
        <form onSubmit={handleCreateUser} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
          <h3>新規ユーザー作成</h3>
          <div>
            <input
              type="text"
              placeholder="ユーザー名"
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              required
            />
          </div>
          <div>
            <input
              type="email"
              placeholder="メールアドレス"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              required
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="GitHub ID"
              value={newUser.github_id}
              onChange={(e) => setNewUser({...newUser, github_id: e.target.value})}
            />
          </div>
          <button type="submit" disabled={isCreating}>
            {isCreating ? '作成中...' : '作成'}
          </button>
        </form>

        {/* ユーザーリスト */}
        <div>
          {users.map((user) => (
            <div 
              key={user.id} 
              style={{ 
                padding: '10px', 
                margin: '5px 0', 
                border: '1px solid #ddd',
                backgroundColor: selectedUserId === user.id ? '#e3f2fd' : 'white',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedUserId(user.id)}
            >
              <strong>{user.username}</strong>
              <br />
              {user.email}
              <br />
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  const newUsername = prompt('新しいユーザー名', user.username)
                  if (newUsername) {
                    handleUpdateUser(user.id, { username: newUsername })
                  }
                }}
                disabled={isUpdating}
              >
                編集
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteUser(user.id)
                }}
                disabled={isDeleting}
                style={{ marginLeft: '10px' }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ユーザー詳細 */}
      <div style={{ flex: 1 }}>
        <h2>ユーザー詳細</h2>
        {selectedUser ? (
          <div style={{ padding: '20px', border: '1px solid #ddd' }}>
            <h3>{selectedUser.username}</h3>
            <p><strong>ID:</strong> {selectedUser.id}</p>
            <p><strong>メール:</strong> {selectedUser.email}</p>
            <p><strong>GitHub ID:</strong> {selectedUser.github_id}</p>
            {selectedUser.avatar_url && (
              <div>
                <strong>アバター:</strong>
                <br />
                <img 
                  src={selectedUser.avatar_url} 
                  alt="Avatar" 
                  style={{ width: '100px', height: '100px', borderRadius: '50%' }}
                />
              </div>
            )}
            <p><strong>作成日:</strong> {new Date(selectedUser.created_at).toLocaleDateString()}</p>
            <p><strong>更新日:</strong> {new Date(selectedUser.updated_at).toLocaleDateString()}</p>
          </div>
        ) : (
          <p>ユーザーを選択してください</p>
        )}
      </div>
    </div>
  )
}
```

## 🏗️ 実用的な例

### Todo アプリケーション

```tsx
import React, { useState } from 'react'
import { useData, useAuth, useRealtimeSubscription } from '@vibebase/react'

interface Todo {
  id: string
  title: string
  completed: boolean
  user_id: string
  created_at: string
  updated_at: string
}

function TodoApp() {
  const { user, isAuthenticated } = useAuth()
  const [newTodoTitle, setNewTodoTitle] = useState('')
  
  const {
    data: todos,
    isLoading,
    error,
    create,
    update,
    delete: deleteTodo,
    isCreating,
    isUpdating,
    isDeleting
  } = useData<Todo>('todos', {
    // 現在のユーザーのTodoのみ取得（RBAC適用）
    realtimeEnabled: true
  })

  // リアルタイムでTodoの変更を監視
  useRealtimeSubscription('todos', '*', (event) => {
    console.log('Todo変更イベント:', event)
    // useDataのリアルタイム機能で自動更新されるため、ここでは追加処理のみ
  })

  if (!isAuthenticated) {
    return <div>ログインしてください</div>
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
      console.error('Todo作成エラー:', error)
    }
  }

  const handleToggleComplete = async (todo: Todo) => {
    try {
      await update(todo.id, {
        completed: !todo.completed
      })
    } catch (error) {
      console.error('Todo更新エラー:', error)
    }
  }

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteTodo(todoId)
    } catch (error) {
      console.error('Todo削除エラー:', error)
    }
  }

  if (isLoading) return <div>Todoを読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  const completedCount = todos.filter(todo => todo.completed).length
  const totalCount = todos.length

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>My Todo App</h1>
      <p>ようこそ、{user?.username}さん！</p>
      
      <div style={{ marginBottom: '20px' }}>
        <p>進捗: {completedCount} / {totalCount} 完了</p>
        <div style={{ 
          width: '100%', 
          height: '10px', 
          backgroundColor: '#f0f0f0',
          borderRadius: '5px'
        }}>
          <div style={{
            width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
            height: '100%',
            backgroundColor: '#4caf50',
            borderRadius: '5px'
          }} />
        </div>
      </div>

      <form onSubmit={handleAddTodo} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="新しいTodoを入力..."
          style={{ width: '70%', padding: '10px' }}
        />
        <button 
          type="submit" 
          disabled={isCreating}
          style={{ width: '25%', padding: '10px', marginLeft: '5%' }}
        >
          {isCreating ? '追加中...' : '追加'}
        </button>
      </form>

      <div>
        {todos.map((todo) => (
          <div 
            key={todo.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              margin: '5px 0',
              backgroundColor: todo.completed ? '#f5f5f5' : 'white',
              border: '1px solid #ddd',
              borderRadius: '5px'
            }}
          >
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggleComplete(todo)}
              disabled={isUpdating}
              style={{ marginRight: '10px' }}
            />
            
            <span style={{ 
              flex: 1,
              textDecoration: todo.completed ? 'line-through' : 'none',
              color: todo.completed ? '#666' : 'black'
            }}>
              {todo.title}
            </span>
            
            <small style={{ marginRight: '10px', color: '#666' }}>
              {new Date(todo.created_at).toLocaleDateString()}
            </small>
            
            <button
              onClick={() => handleDeleteTodo(todo.id)}
              disabled={isDeleting}
              style={{ 
                backgroundColor: '#ff4444', 
                color: 'white', 
                border: 'none', 
                padding: '5px 10px',
                borderRadius: '3px'
              }}
            >
              削除
            </button>
          </div>
        ))}

        {todos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            まだTodoがありません。上記から追加してください。
          </div>
        )}
      </div>
    </div>
  )
}
```

### ブログダッシュボード

```tsx
import React, { useState } from 'react'
import { 
  useData, 
  useAuth, 
  useFileUpload, 
  useRealtimeSubscription,
  useCustomQuery 
} from '@vibebase/react'

interface BlogPost {
  id: string
  title: string
  content: string
  excerpt: string
  featured_image?: string
  published: boolean
  author_id: string
  view_count: number
  created_at: string
  updated_at: string
}

interface BlogStats {
  total_posts: number
  published_posts: number
  total_views: number
  avg_views_per_post: number
}

function BlogDashboard() {
  const { user } = useAuth()
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  
  const { upload, isUploading } = useFileUpload()
  
  // 投稿一覧
  const {
    data: posts,
    isLoading: isLoadingPosts,
    create: createPost,
    update: updatePost,
    delete: deletePost,
    isCreating,
    isUpdating
  } = useData<BlogPost>('blog_posts', {
    orderBy: 'updated_at',
    orderDirection: 'desc',
    realtimeEnabled: true
  })

  // ブログ統計情報
  const {
    data: stats,
    execute: fetchStats,
    isLoading: isLoadingStats
  } = useCustomQuery<BlogStats>('blog-stats')

  // 新しいコメントやビューをリアルタイムで監視
  useRealtimeSubscription('blog_comments', 'insert', (event) => {
    console.log('新しいコメント:', event.data)
    // 通知表示などの処理
  })

  React.useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleImageUpload = async (file: File) => {
    try {
      const result = await upload(file, `blog-images/${Date.now()}-${file.name}`, {
        makePublic: true
      })
      return result.url
    } catch (error) {
      console.error('画像アップロードエラー:', error)
      throw error
    }
  }

  const handleCreatePost = async (postData: Partial<BlogPost>) => {
    try {
      await createPost({
        ...postData,
        author_id: user!.id,
        view_count: 0,
        published: false
      })
      fetchStats() // 統計情報を更新
    } catch (error) {
      console.error('投稿作成エラー:', error)
    }
  }

  const handlePublishPost = async (post: BlogPost) => {
    try {
      await updatePost(post.id, {
        published: !post.published
      })
      fetchStats() // 統計情報を更新
    } catch (error) {
      console.error('投稿公開エラー:', error)
    }
  }

  if (isLoadingPosts) return <div>投稿を読み込み中...</div>

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* サイドバー - 投稿一覧 */}
      <div style={{ width: '300px', borderRight: '1px solid #ddd', padding: '20px' }}>
        <h2>ブログ投稿</h2>
        
        {/* 統計情報 */}
        {stats.length > 0 && (
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '5px',
            marginBottom: '20px'
          }}>
            <h3>統計情報</h3>
            <p>総投稿数: {stats[0].total_posts}</p>
            <p>公開済み: {stats[0].published_posts}</p>
            <p>総ビュー数: {stats[0].total_views}</p>
            <p>平均ビュー: {Math.round(stats[0].avg_views_per_post)}</p>
          </div>
        )}

        <button
          onClick={() => {
            setSelectedPost(null)
            setIsEditing(true)
          }}
          style={{ 
            width: '100%', 
            padding: '10px', 
            marginBottom: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          新規投稿
        </button>

        <div style={{ height: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => {
                setSelectedPost(post)
                setIsEditing(false)
              }}
              style={{
                padding: '10px',
                margin: '5px 0',
                border: '1px solid #ddd',
                borderRadius: '5px',
                cursor: 'pointer',
                backgroundColor: selectedPost?.id === post.id ? '#e3f2fd' : 'white'
              }}
            >
              <h4 style={{ margin: '0 0 5px 0' }}>{post.title}</h4>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                {post.published ? '🟢 公開中' : '🔴 下書き'} | 
                ビュー: {post.view_count} |
                {new Date(post.updated_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* メインエリア - 編集/プレビュー */}
      <div style={{ flex: 1, padding: '20px' }}>
        {isEditing ? (
          <PostEditor 
            post={selectedPost}
            onSave={selectedPost ? 
              (data) => updatePost(selectedPost.id, data) : 
              handleCreatePost
            }
            onCancel={() => setIsEditing(false)}
            onImageUpload={handleImageUpload}
            isUploading={isUploading}
            isSaving={isCreating || isUpdating}
          />
        ) : selectedPost ? (
          <PostPreview 
            post={selectedPost}
            onEdit={() => setIsEditing(true)}
            onPublish={() => handlePublishPost(selectedPost)}
            onDelete={() => {
              if (confirm('この投稿を削除しますか？')) {
                deletePost(selectedPost.id)
                setSelectedPost(null)
                fetchStats()
              }
            }}
          />
        ) : (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: '#666'
          }}>
            投稿を選択するか、新規投稿を作成してください
          </div>
        )}
      </div>
    </div>
  )
}

// 投稿エディターコンポーネント
function PostEditor({ 
  post, 
  onSave, 
  onCancel, 
  onImageUpload, 
  isUploading,
  isSaving 
}: {
  post: BlogPost | null
  onSave: (data: Partial<BlogPost>) => Promise<void>
  onCancel: () => void
  onImageUpload: (file: File) => Promise<string>
  isUploading: boolean
  isSaving: boolean
}) {
  const [formData, setFormData] = useState({
    title: post?.title || '',
    content: post?.content || '',
    excerpt: post?.excerpt || '',
    featured_image: post?.featured_image || ''
  })

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const imageUrl = await onImageUpload(file)
      setFormData(prev => ({ ...prev, featured_image: imageUrl }))
    } catch (error) {
      alert('画像アップロードに失敗しました')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSave(formData)
      if (!post) {
        // 新規作成の場合はフォームをリセット
        setFormData({ title: '', content: '', excerpt: '', featured_image: '' })
      }
      onCancel()
    } catch (error) {
      alert('保存に失敗しました')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="タイトル"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          style={{ width: '100%', padding: '10px', fontSize: '18px' }}
          required
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <textarea
          placeholder="概要"
          value={formData.excerpt}
          onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
          style={{ width: '100%', padding: '10px', height: '80px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>アイキャッチ画像:</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          disabled={isUploading}
        />
        {isUploading && <span>アップロード中...</span>}
        {formData.featured_image && (
          <img 
            src={formData.featured_image} 
            alt="Featured" 
            style={{ maxWidth: '200px', display: 'block', marginTop: '10px' }}
          />
        )}
      </div>

      <div style={{ flex: 1, marginBottom: '20px' }}>
        <textarea
          placeholder="本文"
          value={formData.content}
          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
          style={{ width: '100%', height: '100%', padding: '10px' }}
          required
        />
      </div>

      <div>
        <button 
          type="submit" 
          disabled={isSaving}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#28a745', 
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            marginRight: '10px'
          }}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button 
          type="button" 
          onClick={onCancel}
          style={{ 
            padding: '10px 20px', 
            backgroundColor: '#6c757d', 
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

// 投稿プレビューコンポーネント
function PostPreview({ 
  post, 
  onEdit, 
  onPublish, 
  onDelete 
}: {
  post: BlogPost
  onEdit: () => void
  onPublish: () => void
  onDelete: () => void
}) {
  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={onEdit} style={{ padding: '10px 20px' }}>
          編集
        </button>
        <button 
          onClick={onPublish}
          style={{ 
            padding: '10px 20px',
            backgroundColor: post.published ? '#ffc107' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          {post.published ? '非公開にする' : '公開する'}
        </button>
        <button 
          onClick={onDelete}
          style={{ 
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          削除
        </button>
      </div>

      <article>
        <h1>{post.title}</h1>
        
        {post.featured_image && (
          <img 
            src={post.featured_image} 
            alt="Featured" 
            style={{ maxWidth: '100%', height: 'auto', marginBottom: '20px' }}
          />
        )}
        
        {post.excerpt && (
          <p style={{ 
            fontStyle: 'italic', 
            color: '#666', 
            marginBottom: '20px',
            padding: '15px',
            backgroundColor: '#f8f9fa',
            borderLeft: '4px solid #007bff'
          }}>
            {post.excerpt}
          </p>
        )}
        
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
          {post.content}
        </div>
        
        <footer style={{ 
          marginTop: '40px', 
          paddingTop: '20px', 
          borderTop: '1px solid #ddd',
          color: '#666',
          fontSize: '14px'
        }}>
          <p>ビュー数: {post.view_count}</p>
          <p>作成日: {new Date(post.created_at).toLocaleString()}</p>
          <p>更新日: {new Date(post.updated_at).toLocaleString()}</p>
        </footer>
      </article>
    </div>
  )
}

export default BlogDashboard
```

## 🎯 ベストプラクティス

### 1. エラーハンドリング

```tsx
import React from 'react'
import { useData } from '@vibebase/react'

function ErrorBoundaryExample() {
  const { data, error, isLoading, refetch } = useData('users')

  // ローディング状態
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div>読み込み中...</div>
        <div style={{ marginTop: '10px' }}>
          <div className="spinner"></div>
        </div>
      </div>
    )
  }

  // エラー状態
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8d7da', 
        border: '1px solid #f5c6cb',
        borderRadius: '5px',
        color: '#721c24'
      }}>
        <h3>エラーが発生しました</h3>
        <p>{error.message}</p>
        <button 
          onClick={refetch}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px'
          }}
        >
          再試行
        </button>
      </div>
    )
  }

  return <div>{/* 正常なコンテンツ */}</div>
}
```

### 2. パフォーマンス最適化

```tsx
import React, { useMemo } from 'react'
import { useData } from '@vibebase/react'

function OptimizedList() {
  const { data: users } = useData('users')

  // 重い計算をメモ化
  const sortedUsers = useMemo(() => {
    return users
      .filter(user => user.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users])

  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.active).length,
      inactive: users.filter(u => !u.active).length
    }
  }, [users])

  return (
    <div>
      <div>統計: 総数{userStats.total}, アクティブ{userStats.active}</div>
      <div>
        {sortedUsers.map(user => (
          <UserItem key={user.id} user={user} />
        ))}
      </div>
    </div>
  )
}

// ユーザーアイテムをメモ化してre-renderを防ぐ
const UserItem = React.memo(({ user }: { user: any }) => {
  return <div>{user.name}</div>
})
```

### 3. カスタムフック

```tsx
import { useCallback } from 'react'
import { useData, useAuth } from '@vibebase/react'

// カスタムフックの作成
function useMyPosts() {
  const { user } = useAuth()
  
  const {
    data: posts,
    create,
    update,
    delete: deletePost,
    ...rest
  } = useData('posts', {
    // ユーザーの投稿のみを取得（RBACで自動フィルタリング）
    realtimeEnabled: true
  })

  const createPost = useCallback(async (postData: any) => {
    return create({
      ...postData,
      author_id: user?.id
    })
  }, [create, user?.id])

  const publishPost = useCallback(async (postId: string) => {
    return update(postId, { published: true, published_at: new Date().toISOString() })
  }, [update])

  return {
    posts,
    createPost,
    publishPost,
    updatePost: update,
    deletePost,
    ...rest
  }
}

// 使用例
function MyBlog() {
  const { posts, createPost, publishPost } = useMyPosts()
  
  // ブログロジック
}
```

## 🔧 設定とカスタマイズ

### プロバイダーの詳細設定

```tsx
import React from 'react'
import { VibebaseProvider, VibebaseClient } from '@vibebase/react'

const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev',
  timeout: 15000,
  retries: 5,
  debug: process.env.NODE_ENV === 'development'
})

function App() {
  return (
    <VibebaseProvider client={client}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Router>
    </VibebaseProvider>
  )
}
```

### 環境変数の活用

```tsx
// .env.local
NEXT_PUBLIC_VIBEBASE_API_URL=https://your-app.your-subdomain.workers.dev
NEXT_PUBLIC_VIBEBASE_DEBUG=true

// components/VibebaseProvider.tsx
import { VibebaseProvider } from '@vibebase/react'

export function AppVibebaseProvider({ children }: { children: React.ReactNode }) {
  return (
    <VibebaseProvider
      config={{
        apiUrl: process.env.NEXT_PUBLIC_VIBEBASE_API_URL!,
        debug: process.env.NEXT_PUBLIC_VIBEBASE_DEBUG === 'true'
      }}
    >
      {children}
    </VibebaseProvider>
  )
}
```

## 📚 参考リンク

- [React Hooks ドキュメント](https://ja.reactjs.org/docs/hooks-intro.html)
- [TypeScript React チートシート](https://react-typescript-cheatsheet.netlify.app/)
- [Vibebase TypeScript SDK](./SDK_TYPESCRIPT.md)

---

このドキュメントでわからない点があれば、[GitHubのIssues](https://github.com/vibebase/vibebase/issues)で質問してください。