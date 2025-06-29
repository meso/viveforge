# Vibebase TypeScript SDK ドキュメント

Vibebase TypeScript SDKは、Cloudflare上で動作するBaaSプラットフォームのためのクライアントライブラリです。型安全性とシンプルなAPIを提供し、JavaScript/TypeScriptアプリケーションから簡単にVibebaseを利用できます。

## 📦 インストール

```bash
npm install @vibebase/sdk
# または
yarn add @vibebase/sdk
# または
pnpm add @vibebase/sdk
```

## 🚀 クイックスタート

### 基本セットアップ

```typescript
import { VibebaseClient } from '@vibebase/sdk'

const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev',
  // その他のオプション設定
})
```

### 認証設定

```typescript
// 管理者認証（JWTトークン）
client.setUserToken('your-jwt-token')

// APIキー認証
client.setApiKey('your-api-key')
```

## 🔐 認証機能

### OAuth認証

```typescript
// ログインURLを取得
const loginUrl = await client.auth.loginWithProvider('github', 'https://your-app.com/callback')
// ユーザーをログインページにリダイレクト
window.location.href = loginUrl

// コールバック後、認証状態を確認
const authResponse = await client.auth.checkStatus()
if (authResponse.success) {
  console.log('ログイン成功:', authResponse.data.user)
}
```

### トークンリフレッシュ

```typescript
// リフレッシュトークンを使用してアクセストークンを更新
const refreshResponse = await client.auth.refreshToken('your-refresh-token')
if (refreshResponse.success) {
  client.setUserToken(refreshResponse.data.access_token)
}
```

### ログアウト

```typescript
await client.auth.logout()
client.clearAuth()
```

## 🗄️ データベース操作

### 基本的なCRUD操作

```typescript
// ユーザーインターフェース
interface User {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

// データ作成
const createResponse = await client.data.create<User>('users', {
  name: '田中太郎',
  email: 'tanaka@example.com'
})

if (createResponse.success) {
  console.log('作成されたユーザー:', createResponse.data)
}

// データ取得（リスト）
const listResponse = await client.data.list<User>('users', {
  limit: 10,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'desc'
})

if (listResponse.success) {
  console.log('ユーザー一覧:', listResponse.data.data)
  console.log('総件数:', listResponse.data.total)
}

// データ取得（ID指定）
const getResponse = await client.data.get<User>('users', 'user-id-123')
if (getResponse.success) {
  console.log('ユーザー詳細:', getResponse.data)
}

// データ更新
const updateResponse = await client.data.update<User>('users', 'user-id-123', {
  name: '田中次郎'
})

// データ削除
const deleteResponse = await client.data.delete('users', 'user-id-123')
```

### 検索とフィルタリング

```typescript
// 検索機能
const searchResponse = await client.data.list<User>('users', {
  search: '田中',
  searchColumns: ['name', 'email'],
  limit: 20
})

// 複雑なクエリオプション
const complexQuery = await client.data.list<User>('users', {
  limit: 50,
  offset: 100,
  orderBy: 'created_at',
  orderDirection: 'asc',
  search: 'engineer',
  searchColumns: ['name', 'bio', 'skills']
})
```

## 📁 ストレージ機能

### ファイルアップロード

```typescript
// ファイルアップロード
const file = new File(['Hello World'], 'hello.txt', { type: 'text/plain' })

const uploadResponse = await client.storage.upload(file, 'hello.txt', {
  makePublic: true,
  contentType: 'text/plain'
})

if (uploadResponse.success) {
  console.log('アップロード完了:', uploadResponse.data)
  console.log('ファイルURL:', uploadResponse.data.url)
}
```

### ファイル操作

```typescript
// ファイル情報取得
const infoResponse = await client.storage.getInfo('hello.txt')

// ダウンロードURL生成（プリサインURL）
const downloadResponse = await client.storage.getDownloadUrl('hello.txt', 3600) // 1時間有効

// ファイル一覧取得
const listResponse = await client.storage.list()
if (listResponse.success) {
  console.log('ファイル一覧:', listResponse.data.files)
}

// ファイル削除
const deleteResponse = await client.storage.delete('hello.txt')
```

### 画像アップロードの例

```typescript
// 画像ファイルの処理
const handleImageUpload = async (imageFile: File) => {
  try {
    const uploadResponse = await client.storage.upload(imageFile, `images/${Date.now()}-${imageFile.name}`, {
      makePublic: true,
      contentType: imageFile.type
    })

    if (uploadResponse.success) {
      const imageUrl = uploadResponse.data.url
      console.log('画像URL:', imageUrl)
      
      // データベースに画像情報を保存
      await client.data.create('photos', {
        title: 'マイ写真',
        url: imageUrl,
        filename: uploadResponse.data.fileName,
        size: uploadResponse.data.size
      })
    }
  } catch (error) {
    console.error('アップロード失敗:', error)
  }
}
```

## ⚡ リアルタイム機能

### リアルタイム接続

```typescript
// リアルタイム接続の初期化
const realtimeClient = client.realtime

// 接続開始
await realtimeClient.connect()

// 接続状態の確認
console.log('接続状態:', realtimeClient.isConnected())
```

### データ変更の監視

```typescript
// テーブルのinsertイベントを監視
const unsubscribe = realtimeClient.subscribe('users', 'insert', (event) => {
  console.log('新しいユーザーが作成されました:', event.data)
  // UIの更新処理
  updateUserList()
})

// 全てのイベントを監視
const unsubscribeAll = realtimeClient.subscribe('users', '*', (event) => {
  console.log('ユーザーテーブルに変更:', event)
  
  switch (event.eventType) {
    case 'insert':
      console.log('新規作成:', event.data)
      break
    case 'update':
      console.log('更新:', event.data)
      break
    case 'delete':
      console.log('削除:', event.data)
      break
  }
})

// 購読解除
unsubscribe.unsubscribe()
```

### フックの管理

```typescript
// データ変更フックの作成
const hookResponse = await client.realtime.createHook('users', 'insert')
if (hookResponse.success) {
  console.log('フック作成完了:', hookResponse.data)
}

// フック一覧取得
const hooksResponse = await client.realtime.listHooks()

// フック削除
await client.realtime.deleteHook('hook-id-123')
```

## 📊 カスタムSQL機能

### SQL実行

```typescript
// カスタムSQLクエリの実行
const queryResponse = await client.customQueries.execute<User>('get-active-users', {
  status: 'active',
  limit: 100
})

if (queryResponse.success) {
  console.log('アクティブユーザー:', queryResponse.data.data)
}
```

### パラメーター付きクエリ

```typescript
// 複雑なレポートクエリの例
interface ReportData {
  month: string
  user_count: number
  total_revenue: number
}

const reportResponse = await client.customQueries.execute<ReportData>('monthly-report', {
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  category: 'premium'
})

if (reportResponse.success) {
  console.log('月次レポート:', reportResponse.data.data)
}
```

## 👤 ユーザー管理

### エンドユーザーの管理

```typescript
// エンドユーザー作成
const createUserResponse = await client.users.create({
  github_id: '12345',
  username: 'developer123',
  email: 'developer@example.com',
  avatar_url: 'https://github.com/developer123.png'
})

// ユーザー一覧取得
const usersResponse = await client.users.list({
  limit: 20,
  offset: 0
})

// ユーザー詳細取得
const userResponse = await client.users.get('user-id-123')

// ユーザー更新
const updateUserResponse = await client.users.update('user-id-123', {
  username: 'new-username'
})

// ユーザー削除
await client.users.delete('user-id-123')
```

## 🏗️ 高度な使用例

### ブログアプリケーションの例

```typescript
interface BlogPost {
  id: string
  title: string
  content: string
  author_id: string
  published_at: string | null
  created_at: string
  updated_at: string
}

interface BlogComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
}

class BlogService {
  constructor(private client: VibebaseClient) {}

  // 記事の公開
  async publishPost(title: string, content: string, authorId: string) {
    const response = await this.client.data.create<BlogPost>('posts', {
      title,
      content,
      author_id: authorId,
      published_at: new Date().toISOString()
    })

    if (response.success) {
      // リアルタイムで新記事を通知
      console.log('新しい記事が公開されました:', response.data)
    }

    return response
  }

  // 公開記事一覧取得
  async getPublishedPosts(page = 0, limit = 10) {
    return await this.client.data.list<BlogPost>('posts', {
      limit,
      offset: page * limit,
      orderBy: 'published_at',
      orderDirection: 'desc'
    })
  }

  // コメント追加
  async addComment(postId: string, authorId: string, content: string) {
    return await this.client.data.create<BlogComment>('comments', {
      post_id: postId,
      author_id: authorId,
      content
    })
  }

  // リアルタイムコメント監視
  async subscribeToComments(postId: string, callback: (comment: BlogComment) => void) {
    return this.client.realtime.subscribe('comments', 'insert', (event) => {
      if (event.data.post_id === postId) {
        callback(event.data as BlogComment)
      }
    })
  }
}

// 使用例
const blogService = new BlogService(client)

// 記事投稿
await blogService.publishPost(
  'Vibebase SDKの使い方',
  'Vibebase SDKを使って簡単にバックエンドを構築する方法を紹介します...',
  'author-123'
)

// リアルタイムでコメントを監視
const unsubscribe = await blogService.subscribeToComments('post-123', (comment) => {
  console.log('新しいコメント:', comment)
  // UIを更新
})
```

### ECサイトの例

```typescript
interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
  image_url?: string
}

interface Order {
  id: string
  user_id: string
  total_amount: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered'
  created_at: string
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
}

class ECommerceService {
  constructor(private client: VibebaseClient) {}

  // 商品検索
  async searchProducts(query: string, category?: string) {
    const options: any = {
      search: query,
      searchColumns: ['name', 'description'],
      limit: 20
    }

    // カテゴリフィルターは実際のAPIでサポートされている場合のみ
    return await this.client.data.list<Product>('products', options)
  }

  // 注文作成
  async createOrder(userId: string, items: Array<{productId: string, quantity: number}>) {
    // 1. 商品情報と在庫確認
    const products = await Promise.all(
      items.map(item => this.client.data.get<Product>('products', item.productId))
    )

    let totalAmount = 0
    for (let i = 0; i < products.length; i++) {
      const productResponse = products[i]
      if (!productResponse.success) {
        throw new Error(`商品が見つかりません: ${items[i].productId}`)
      }

      const product = productResponse.data
      if (product.stock < items[i].quantity) {
        throw new Error(`在庫不足: ${product.name}`)
      }

      totalAmount += product.price * items[i].quantity
    }

    // 2. 注文作成
    const orderResponse = await this.client.data.create<Order>('orders', {
      user_id: userId,
      total_amount: totalAmount,
      status: 'pending'
    })

    if (!orderResponse.success) {
      throw new Error('注文作成に失敗しました')
    }

    // 3. 注文商品作成
    for (let i = 0; i < items.length; i++) {
      const product = products[i].data
      await this.client.data.create<OrderItem>('order_items', {
        order_id: orderResponse.data.id,
        product_id: items[i].productId,
        quantity: items[i].quantity,
        unit_price: product.price
      })

      // 4. 在庫更新
      await this.client.data.update<Product>('products', items[i].productId, {
        stock: product.stock - items[i].quantity
      })
    }

    return orderResponse.data
  }

  // 在庫監視
  async monitorStock() {
    return this.client.realtime.subscribe('products', 'update', (event) => {
      const product = event.data as Product
      if (product.stock <= 5) {
        console.warn(`在庫警告: ${product.name} の在庫が ${product.stock} 個になりました`)
        // 管理者に通知
      }
    })
  }
}
```

## 🔧 設定とオプション

### クライアント設定

```typescript
const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev',
  timeout: 10000, // タイムアウト設定（ミリ秒）
  retries: 3,     // リトライ回数
  debug: true     // デバッグモード
})
```

### エラーハンドリング

```typescript
try {
  const response = await client.data.create('users', userData)
  
  if (!response.success) {
    // APIエラーの処理
    console.error('API Error:', response.error)
    return
  }
  
  // 成功時の処理
  console.log('Success:', response.data)
} catch (error) {
  // ネットワークエラーやその他の例外
  console.error('Network Error:', error)
}
```

### レスポンス型定義

```typescript
// 全てのAPIレスポンスは以下の形式
interface VibebaseResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// データリスト用レスポンス
interface DataListResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
```

## 🎯 ベストプラクティス

### 1. 型安全性の活用

```typescript
// インターフェースを定義して型安全性を確保
interface User {
  id: string
  name: string
  email: string
  created_at: string
  updated_at: string
}

// 型付きでデータ操作
const users = await client.data.list<User>('users')
```

### 2. エラーハンドリング

```typescript
const handleDataOperation = async () => {
  try {
    const response = await client.data.create('users', userData)
    
    if (!response.success) {
      throw new Error(response.error || 'Unknown error')
    }
    
    return response.data
  } catch (error) {
    console.error('Operation failed:', error)
    // ユーザーに適切なエラーメッセージを表示
    throw error
  }
}
```

### 3. リアルタイム機能の適切な管理

```typescript
class RealtimeManager {
  private subscriptions: Array<{ unsubscribe: () => void }> = []

  subscribe(table: string, eventType: string, callback: Function) {
    const subscription = client.realtime.subscribe(table, eventType, callback)
    this.subscriptions.push(subscription)
    return subscription
  }

  cleanup() {
    // コンポーネントのアンマウント時に全ての購読を解除
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions = []
  }
}
```

### 4. パフォーマンス最適化

```typescript
// ページネーションの適切な実装
const loadMoreData = async (currentPage: number) => {
  const ITEMS_PER_PAGE = 20
  
  const response = await client.data.list('products', {
    limit: ITEMS_PER_PAGE,
    offset: currentPage * ITEMS_PER_PAGE,
    orderBy: 'created_at',
    orderDirection: 'desc'
  })
  
  return response
}
```

## 📚 参考リンク

- [Vibebase公式ドキュメント](https://github.com/vibebase/vibebase)
- [TypeScript ハンドブック](https://www.typescriptlang.org/docs/)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)

---

このドキュメントでわからない点があれば、[GitHubのIssues](https://github.com/vibebase/vibebase/issues)で質問してください。