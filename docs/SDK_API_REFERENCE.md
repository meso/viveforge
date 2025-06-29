# Vibebase SDK APIリファレンス

このドキュメントは、Vibebase TypeScript SDK および React SDK の全APIの詳細なリファレンスです。

## 📋 目次

- [TypeScript SDK](#typescript-sdk)
  - [VibebaseClient](#vibebaseclient)
  - [認証 API](#認証-api)
  - [データ API](#データ-api)
  - [ストレージ API](#ストレージ-api)
  - [リアルタイム API](#リアルタイム-api)
  - [カスタムクエリ API](#カスタムクエリ-api)
  - [ユーザー API](#ユーザー-api)
- [React SDK](#react-sdk)
  - [プロバイダー](#プロバイダー)
  - [認証 Hooks](#認証-hooks)
  - [データ Hooks](#データ-hooks)
  - [ストレージ Hooks](#ストレージ-hooks)
  - [リアルタイム Hooks](#リアルタイム-hooks)
  - [カスタムクエリ Hooks](#カスタムクエリ-hooks)
  - [ユーザー Hooks](#ユーザー-hooks)

---

## TypeScript SDK

### VibebaseClient

Vibebase サービスへのメインクライアント。

#### コンストラクタ

```typescript
new VibebaseClient(config: VibebaseConfig)
```

**パラメータ:**

```typescript
interface VibebaseConfig {
  apiUrl: string       // Vibebase API の URL
  timeout?: number     // リクエストタイムアウト（ミリ秒、デフォルト: 30000）
  retries?: number     // リトライ回数（デフォルト: 3）
  debug?: boolean      // デバッグモード（デフォルト: false）
}
```

**例:**

```typescript
const client = new VibebaseClient({
  apiUrl: 'https://your-app.your-subdomain.workers.dev',
  timeout: 10000,
  retries: 5,
  debug: true
})
```

#### メソッド

##### setUserToken(token: string): void

ユーザー認証のJWTトークンを設定します。

```typescript
client.setUserToken('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...')
```

##### setApiKey(apiKey: string): void

API キー認証を設定します。

```typescript
client.setApiKey('vb_api_1234567890abcdef')
```

##### clearAuth(): void

認証情報をクリアします。

```typescript
client.clearAuth()
```

---

### 認証 API

`client.auth` でアクセス。

#### loginWithProvider(provider: string, redirectUri?: string): Promise<string>

OAuth プロバイダーでのログインURL を取得します。

**パラメータ:**
- `provider: string` - OAuth プロバイダー（'github'）
- `redirectUri?: string` - リダイレクト URI

**戻り値:** ログインURL

**例:**

```typescript
const loginUrl = await client.auth.loginWithProvider('github', 'https://your-app.com/callback')
window.location.href = loginUrl
```

#### checkStatus(): Promise<VibebaseResponse<AuthStatusResponse>>

現在の認証状態を確認します。

**戻り値:**

```typescript
interface AuthStatusResponse {
  user: User
  expires_at: string
}

interface User {
  id: string
  username: string
  email: string
  avatar_url?: string
  github_id?: string
  created_at: string
  updated_at: string
}
```

**例:**

```typescript
const response = await client.auth.checkStatus()
if (response.success) {
  console.log('ユーザー:', response.data.user)
}
```

#### refreshToken(refreshToken: string): Promise<VibebaseResponse<RefreshTokenResponse>>

リフレッシュトークンを使用してアクセストークンを更新します。

**パラメータ:**
- `refreshToken: string` - リフレッシュトークン

**戻り値:**

```typescript
interface RefreshTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}
```

**例:**

```typescript
const response = await client.auth.refreshToken('refresh_token_here')
if (response.success) {
  client.setUserToken(response.data.access_token)
}
```

#### logout(): Promise<VibebaseResponse<void>>

ログアウトを実行します。

**例:**

```typescript
await client.auth.logout()
client.clearAuth()
```

---

### データ API

`client.data` でアクセス。

#### list<T>(tableName: string, options?: QueryOptions): Promise<VibebaseResponse<DataListResponse<T>>>

データの一覧を取得します。

**パラメータ:**

```typescript
interface QueryOptions {
  limit?: number           // 取得件数（デフォルト: 50）
  offset?: number          // オフセット（デフォルト: 0）
  orderBy?: string         // ソートカラム
  orderDirection?: 'asc' | 'desc'  // ソート方向
  search?: string          // 検索テキスト
  searchColumns?: string[] // 検索対象カラム
}
```

**戻り値:**

```typescript
interface DataListResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}
```

**例:**

```typescript
const response = await client.data.list<User>('users', {
  limit: 20,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'desc',
  search: 'john',
  searchColumns: ['username', 'email']
})

if (response.success) {
  console.log('ユーザー一覧:', response.data.data)
  console.log('総件数:', response.data.total)
}
```

#### get<T>(tableName: string, id: string): Promise<VibebaseResponse<T>>

IDでデータを取得します。

**例:**

```typescript
const response = await client.data.get<User>('users', 'user-123')
if (response.success) {
  console.log('ユーザー:', response.data)
}
```

#### create<T>(tableName: string, data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<VibebaseResponse<T>>

新しいデータを作成します。

**例:**

```typescript
const response = await client.data.create<User>('users', {
  username: 'john_doe',
  email: 'john@example.com'
})

if (response.success) {
  console.log('作成されたユーザー:', response.data)
}
```

#### update<T>(tableName: string, id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>): Promise<VibebaseResponse<T>>

データを更新します。

**例:**

```typescript
const response = await client.data.update<User>('users', 'user-123', {
  username: 'john_smith'
})

if (response.success) {
  console.log('更新されたユーザー:', response.data)
}
```

#### delete(tableName: string, id: string): Promise<VibebaseResponse<void>>

データを削除します。

**例:**

```typescript
const response = await client.data.delete('users', 'user-123')
if (response.success) {
  console.log('ユーザーが削除されました')
}
```

---

### ストレージ API

`client.storage` でアクセス。

#### upload(file: File, fileName: string, options?: FileUploadOptions): Promise<VibebaseResponse<FileInfo>>

ファイルをアップロードします。

**パラメータ:**

```typescript
interface FileUploadOptions {
  makePublic?: boolean     // 公開ファイルにするか（デフォルト: false）
  contentType?: string     // Content-Type
  metadata?: Record<string, string>  // メタデータ
}
```

**戻り値:**

```typescript
interface FileInfo {
  fileName: string
  url: string
  size: number
  contentType: string
  uploadedAt: string
}
```

**例:**

```typescript
const file = new File(['Hello World'], 'hello.txt', { type: 'text/plain' })

const response = await client.storage.upload(file, 'hello.txt', {
  makePublic: true,
  contentType: 'text/plain'
})

if (response.success) {
  console.log('ファイルURL:', response.data.url)
}
```

#### getDownloadUrl(fileName: string, expiresIn?: number): Promise<VibebaseResponse<{ url: string }>>

ダウンロード用のプリサインURLを取得します。

**パラメータ:**
- `fileName: string` - ファイル名
- `expiresIn?: number` - 有効期限（秒、デフォルト: 3600）

**例:**

```typescript
const response = await client.storage.getDownloadUrl('hello.txt', 7200)
if (response.success) {
  console.log('ダウンロードURL:', response.data.url)
}
```

#### getInfo(fileName: string): Promise<VibebaseResponse<FileInfo>>

ファイル情報を取得します。

**例:**

```typescript
const response = await client.storage.getInfo('hello.txt')
if (response.success) {
  console.log('ファイル情報:', response.data)
}
```

#### list(): Promise<VibebaseResponse<{ files: FileInfo[] }>>

ファイル一覧を取得します。

**例:**

```typescript
const response = await client.storage.list()
if (response.success) {
  console.log('ファイル一覧:', response.data.files)
}
```

#### delete(fileName: string): Promise<VibebaseResponse<void>>

ファイルを削除します。

**例:**

```typescript
const response = await client.storage.delete('hello.txt')
if (response.success) {
  console.log('ファイルが削除されました')
}
```

---

### リアルタイム API

`client.realtime` でアクセス。

#### connect(): Promise<void>

リアルタイム接続を開始します。

**例:**

```typescript
await client.realtime.connect()
console.log('リアルタイム接続完了')
```

#### disconnect(): void

リアルタイム接続を切断します。

**例:**

```typescript
client.realtime.disconnect()
```

#### isConnected(): boolean

接続状態を確認します。

**例:**

```typescript
if (client.realtime.isConnected()) {
  console.log('接続中')
}
```

#### subscribe(tableName: string, eventType: 'insert' | 'update' | 'delete' | '*', callback: (event: RealtimeEvent) => void): RealtimeSubscription

テーブルのイベントを監視します。

**パラメータ:**

```typescript
interface RealtimeEvent {
  eventType: 'insert' | 'update' | 'delete'
  tableName: string
  data: any
  timestamp: string
}

interface RealtimeSubscription {
  unsubscribe(): void
}
```

**例:**

```typescript
const subscription = client.realtime.subscribe('users', 'insert', (event) => {
  console.log('新しいユーザー:', event.data)
})

// 購読解除
subscription.unsubscribe()
```

#### createHook(tableName: string, eventType: 'insert' | 'update' | 'delete'): Promise<VibebaseResponse<Hook>>

データ変更フックを作成します。

**戻り値:**

```typescript
interface Hook {
  id: string
  table_name: string
  event_type: string
  is_enabled: boolean
  created_at: string
}
```

**例:**

```typescript
const response = await client.realtime.createHook('users', 'insert')
if (response.success) {
  console.log('フック作成完了:', response.data)
}
```

#### listHooks(): Promise<VibebaseResponse<Hook[]>>

フック一覧を取得します。

**例:**

```typescript
const response = await client.realtime.listHooks()
if (response.success) {
  console.log('フック一覧:', response.data)
}
```

#### deleteHook(hookId: string): Promise<VibebaseResponse<void>>

フックを削除します。

**例:**

```typescript
await client.realtime.deleteHook('hook-123')
```

---

### カスタムクエリ API

`client.customQueries` でアクセス。

#### execute<T>(queryName: string, variables?: Record<string, any>): Promise<VibebaseResponse<CustomQueryResponse<T>>>

カスタムSQLクエリを実行します。

**戻り値:**

```typescript
interface CustomQueryResponse<T> {
  data: T[]
  executionTime: number
  rowCount: number
}
```

**例:**

```typescript
const response = await client.customQueries.execute<UserStats>('user-statistics', {
  start_date: '2024-01-01',
  end_date: '2024-12-31'
})

if (response.success) {
  console.log('統計データ:', response.data.data)
  console.log('実行時間:', response.data.executionTime, 'ms')
}
```

---

### ユーザー API

`client.users` でアクセス。

#### list(options?: QueryOptions): Promise<VibebaseResponse<DataListResponse<User>>>

エンドユーザー一覧を取得します。

**例:**

```typescript
const response = await client.users.list({
  limit: 50,
  orderBy: 'created_at',
  orderDirection: 'desc'
})

if (response.success) {
  console.log('ユーザー一覧:', response.data.data)
}
```

#### get(userId: string): Promise<VibebaseResponse<User>>

ユーザー詳細を取得します。

**例:**

```typescript
const response = await client.users.get('user-123')
if (response.success) {
  console.log('ユーザー詳細:', response.data)
}
```

#### create(userData: CreateUserData): Promise<VibebaseResponse<User>>

新しいユーザーを作成します。

**パラメータ:**

```typescript
interface CreateUserData {
  username: string
  email: string
  github_id?: string
  avatar_url?: string
}
```

**例:**

```typescript
const response = await client.users.create({
  username: 'john_doe',
  email: 'john@example.com',
  github_id: '12345'
})

if (response.success) {
  console.log('作成されたユーザー:', response.data)
}
```

#### update(userId: string, userData: Partial<CreateUserData>): Promise<VibebaseResponse<User>>

ユーザー情報を更新します。

**例:**

```typescript
const response = await client.users.update('user-123', {
  username: 'john_smith'
})

if (response.success) {
  console.log('更新されたユーザー:', response.data)
}
```

#### delete(userId: string): Promise<VibebaseResponse<void>>

ユーザーを削除します。

**例:**

```typescript
const response = await client.users.delete('user-123')
if (response.success) {
  console.log('ユーザーが削除されました')
}
```

---

## React SDK

### プロバイダー

#### VibebaseProvider

React アプリケーションでVibebase クライアントを提供するプロバイダー。

**Props:**

```typescript
interface VibebaseProviderProps {
  children: ReactNode
  config: VibebaseConfig
  client?: VibebaseClient  // カスタムクライアント（任意）
}
```

**例:**

```tsx
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
```

#### useVibebase

Vibebase クライアントと接続状態にアクセスするフック。

**戻り値:**

```typescript
interface VibebaseContextValue {
  client: VibebaseClient
  isReady: boolean
}
```

**例:**

```tsx
import { useVibebase } from '@vibebase/react'

function CustomComponent() {
  const { client, isReady } = useVibebase()

  if (!isReady) return <div>初期化中...</div>

  // client を使用してカスタム処理
  return <div>アプリ準備完了</div>
}
```

---

### 認証 Hooks

#### useAuth

認証状態と認証操作を管理するフック。

**戻り値:**

```typescript
interface UseAuthResult {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  login: (provider: string, redirectUri?: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: (refreshToken: string) => Promise<void>
  checkStatus: () => Promise<void>
  setUserToken: (token: string) => void
  setApiKey: (apiKey: string) => void
}
```

**例:**

```tsx
import { useAuth } from '@vibebase/react'

function AuthComponent() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    error, 
    login, 
    logout 
  } = useAuth()

  if (isLoading) return <div>認証確認中...</div>

  return (
    <div>
      {isAuthenticated ? (
        <div>
          <p>ようこそ、{user?.username}さん</p>
          <button onClick={logout}>ログアウト</button>
        </div>
      ) : (
        <button onClick={() => login('github')}>
          GitHubでログイン
        </button>
      )}
    </div>
  )
}
```

---

### データ Hooks

#### useData

データのCRUD操作とリアルタイム監視を行うフック。

**パラメータ:**

```typescript
interface UseDataOptions extends QueryOptions {
  realtimeEnabled?: boolean  // リアルタイム監視の有効化
}
```

**戻り値:**

```typescript
interface UseDataResult<T> {
  data: T[]
  total: number
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<void>
  create: (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => Promise<T>
  update: (id: string, data: Partial<Omit<T, 'id' | 'created_at' | 'updated_at'>>) => Promise<T>
  delete: (id: string) => Promise<void>
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}
```

**例:**

```tsx
import { useData } from '@vibebase/react'

interface Post {
  id: string
  title: string
  content: string
  author_id: string
  created_at: string
  updated_at: string
}

function PostList() {
  const {
    data: posts,
    total,
    isLoading,
    error,
    create,
    update,
    delete: deletePost,
    isCreating
  } = useData<Post>('posts', {
    limit: 20,
    orderBy: 'created_at',
    orderDirection: 'desc',
    realtimeEnabled: true
  })

  const handleCreatePost = async () => {
    await create({
      title: '新しい投稿',
      content: '投稿内容',
      author_id: 'user-123'
    })
  }

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      <h2>投稿一覧 ({total}件)</h2>
      <button onClick={handleCreatePost} disabled={isCreating}>
        {isCreating ? '作成中...' : '新規投稿'}
      </button>
      
      {posts.map(post => (
        <div key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </div>
      ))}
    </div>
  )
}
```

#### useQuery

汎用的なデータ取得フック。

**パラメータ:**

```typescript
interface UseQueryOptions<T> {
  enabled?: boolean              // クエリの有効化（デフォルト: true）
  refetchInterval?: number       // 自動再取得間隔（ミリ秒）
  refetchOnWindowFocus?: boolean // ウィンドウフォーカス時の再取得
  retry?: number | boolean       // リトライ回数
  onSuccess?: (data: T) => void  // 成功時のコールバック
  onError?: (error: Error) => void // エラー時のコールバック
}
```

**戻り値:**

```typescript
interface UseQueryResult<T> {
  data: T | undefined
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  refetch: () => Promise<void>
  isRefetching: boolean
}
```

**例:**

```tsx
import { useQuery, useVibebase } from '@vibebase/react'

function UserProfile({ userId }: { userId: string }) {
  const { client } = useVibebase()
  
  const {
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery(
    async () => {
      const response = await client.data.get('users', userId)
      if (!response.success) {
        throw new Error(response.error)
      }
      return response.data
    },
    {
      enabled: !!userId,
      onSuccess: (data) => {
        console.log('ユーザーデータ取得:', data)
      },
      onError: (error) => {
        console.error('エラー:', error)
      }
    }
  )

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      <h2>{user?.username}</h2>
      <p>{user?.email}</p>
      <button onClick={refetch}>更新</button>
    </div>
  )
}
```

#### useMutation

データ変更操作のフック。

**パラメータ:**

```typescript
interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: Error, variables: TVariables) => void
  onMutate?: (variables: TVariables) => Promise<unknown> | unknown
}
```

**戻り値:**

```typescript
interface UseMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<void>
  mutateAsync: (variables: TVariables) => Promise<TData>
  data: TData | undefined
  error: Error | null
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  reset: () => void
}
```

**例:**

```tsx
import { useMutation, useVibebase } from '@vibebase/react'

function CreatePostForm() {
  const { client } = useVibebase()
  
  const createPostMutation = useMutation(
    async (postData: { title: string; content: string }) => {
      const response = await client.data.create('posts', postData)
      if (!response.success) {
        throw new Error(response.error)
      }
      return response.data
    },
    {
      onSuccess: (data) => {
        alert(`投稿「${data.title}」を作成しました`)
      },
      onError: (error) => {
        alert(`エラー: ${error.message}`)
      }
    }
  )

  const handleSubmit = (formData: { title: string; content: string }) => {
    createPostMutation.mutate(formData)
  }

  return (
    <div>
      {/* フォーム実装 */}
      <button 
        onClick={() => handleSubmit({ title: 'テスト', content: '内容' })}
        disabled={createPostMutation.isLoading}
      >
        {createPostMutation.isLoading ? '作成中...' : '投稿する'}
      </button>
    </div>
  )
}
```

#### useInfiniteQuery

無限スクロール用のページネーションフック。

**パラメータ:**

```typescript
interface UseInfiniteQueryOptions<T> extends UseQueryOptions<T> {
  getNextPageParam?: (lastPage: T, allPages: T[]) => unknown
  getPreviousPageParam?: (firstPage: T, allPages: T[]) => unknown
}
```

**戻り値:**

```typescript
interface UseInfiniteQueryResult<T> {
  data: T[]
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetchingNextPage: boolean
  isFetchingPreviousPage: boolean
  fetchNextPage: () => Promise<void>
  fetchPreviousPage: () => Promise<void>
  error: Error | null
  isLoading: boolean
  refetch: () => Promise<void>
  isRefetching: boolean
}
```

**例:**

```tsx
import { useInfiniteQuery, useVibebase } from '@vibebase/react'

function InfinitePostList() {
  const { client } = useVibebase()

  const {
    data: posts,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading
  } = useInfiniteQuery(
    async (pageParam = 0) => {
      const response = await client.data.list('posts', {
        limit: 10,
        offset: pageParam * 10
      })
      if (!response.success) {
        throw new Error(response.error)
      }
      return response.data
    },
    {
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.data.length === 10 ? allPages.length : undefined
      }
    }
  )

  if (isLoading) return <div>読み込み中...</div>

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
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

---

### ストレージ Hooks

#### useStorage

ストレージ操作のフック。

**戻り値:**

```typescript
interface UseStorageResult {
  upload: (file: File, fileName?: string, options?: FileUploadOptions) => Promise<FileInfo>
  getDownloadUrl: (fileName: string, expiresIn?: number) => Promise<string>
  getInfo: (fileName: string) => Promise<FileInfo>
  delete: (fileName: string) => Promise<void>
  list: () => Promise<FileInfo[]>
  isUploading: boolean
  isDeleting: boolean
  error: Error | null
}
```

**例:**

```tsx
import { useStorage } from '@vibebase/react'

function FileUploader() {
  const {
    upload,
    list,
    delete: deleteFile,
    isUploading,
    error
  } = useStorage()

  const [files, setFiles] = useState<FileInfo[]>([])

  useEffect(() => {
    loadFiles()
  }, [])

  const loadFiles = async () => {
    try {
      const fileList = await list()
      setFiles(fileList)
    } catch (error) {
      console.error('ファイル一覧取得エラー:', error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      await upload(file, undefined, { makePublic: true })
      await loadFiles() // ファイル一覧を更新
    } catch (error) {
      console.error('アップロードエラー:', error)
    }
  }

  return (
    <div>
      <input type="file" onChange={handleFileUpload} disabled={isUploading} />
      {isUploading && <div>アップロード中...</div>}
      {error && <div>エラー: {error.message}</div>}
      
      <div>
        {files.map(file => (
          <div key={file.fileName}>
            {file.fileName}
            <button onClick={() => deleteFile(file.fileName)}>削除</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

#### useFileUpload

プログレス付きファイルアップロードフック。

**戻り値:**

```typescript
interface UseFileUploadResult {
  upload: (file: File, fileName?: string, options?: FileUploadOptions) => Promise<FileInfo>
  uploadMultiple: (files: File[], options?: FileUploadOptions) => Promise<FileInfo[]>
  isUploading: boolean
  progress: UploadProgress | null
  error: Error | null
  reset: () => void
}

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}
```

**例:**

```tsx
import { useFileUpload } from '@vibebase/react'

function ProgressiveUploader() {
  const {
    upload,
    isUploading,
    progress,
    error,
    reset
  } = useFileUpload()

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const result = await upload(file)
      console.log('アップロード完了:', result)
    } catch (error) {
      console.error('アップロードエラー:', error)
    }
  }

  return (
    <div>
      <input type="file" onChange={handleUpload} disabled={isUploading} />
      
      {isUploading && progress && (
        <div>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            backgroundColor: '#f0f0f0',
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress.percentage}%`,
              height: '100%',
              backgroundColor: '#4caf50',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p>{progress.percentage}% ({progress.loaded} / {progress.total} bytes)</p>
        </div>
      )}
      
      {error && (
        <div>
          エラー: {error.message}
          <button onClick={reset}>リセット</button>
        </div>
      )}
    </div>
  )
}
```

---

### リアルタイム Hooks

#### useRealtime

リアルタイム接続の管理フック。

**パラメータ:**

```typescript
interface UseRealtimeOptions {
  enabled?: boolean                 // 自動接続の有効化
  onConnect?: () => void           // 接続時のコールバック
  onDisconnect?: () => void        // 切断時のコールバック
  onError?: (error: Error) => void // エラー時のコールバック
}
```

**戻り値:**

```typescript
interface UseRealtimeResult {
  isConnected: boolean
  subscribe: (
    tableName: string,
    eventType: 'insert' | 'update' | 'delete' | '*',
    callback: (event: RealtimeEvent) => void
  ) => () => void
  unsubscribeAll: () => void
}
```

**例:**

```tsx
import { useRealtime } from '@vibebase/react'

function RealtimeComponent() {
  const [messages, setMessages] = useState<any[]>([])
  
  const { isConnected, subscribe, unsubscribeAll } = useRealtime({
    enabled: true,
    onConnect: () => console.log('リアルタイム接続完了'),
    onDisconnect: () => console.log('リアルタイム接続切断'),
    onError: (error) => console.error('リアルタイムエラー:', error)
  })

  useEffect(() => {
    if (!isConnected) return

    const unsubscribe = subscribe('messages', 'insert', (event) => {
      setMessages(prev => [event.data, ...prev])
    })

    return unsubscribe
  }, [isConnected, subscribe])

  useEffect(() => {
    return () => {
      unsubscribeAll()
    }
  }, [unsubscribeAll])

  return (
    <div>
      <p>接続状態: {isConnected ? '🟢 接続中' : '🔴 切断中'}</p>
      <div>
        {messages.map((message, index) => (
          <div key={index}>{message.content}</div>
        ))}
      </div>
    </div>
  )
}
```

#### useRealtimeSubscription

特定のテーブルイベントを監視するフック。

**パラメータ:**

```typescript
useRealtimeSubscription(
  tableName: string,
  eventType: 'insert' | 'update' | 'delete' | '*',
  callback: (event: RealtimeEvent) => void,
  options?: { enabled?: boolean }
)
```

**例:**

```tsx
import { useRealtimeSubscription } from '@vibebase/react'

function NotificationComponent() {
  const [notifications, setNotifications] = useState<any[]>([])

  useRealtimeSubscription(
    'notifications',
    'insert',
    (event) => {
      setNotifications(prev => [event.data, ...prev.slice(0, 9)]) // 最新10件を保持
      
      // ブラウザ通知
      if (Notification.permission === 'granted') {
        new Notification('新しい通知', {
          body: event.data.message,
          icon: '/favicon.ico'
        })
      }
    },
    { enabled: true }
  )

  return (
    <div>
      <h3>通知</h3>
      {notifications.map((notification, index) => (
        <div key={index} style={{ 
          padding: '10px', 
          margin: '5px 0',
          backgroundColor: '#f0f8ff',
          borderRadius: '5px'
        }}>
          {notification.message}
        </div>
      ))}
    </div>
  )
}
```

---

### カスタムクエリ Hooks

#### useCustomQuery

カスタムSQLクエリの実行フック。

**戻り値:**

```typescript
interface UseCustomQueryResult<T> {
  data: T[]
  error: Error | null
  isLoading: boolean
  execute: (variables?: Record<string, any>) => Promise<void>
  isExecuting: boolean
}
```

**例:**

```tsx
import { useCustomQuery } from '@vibebase/react'

interface ReportData {
  month: string
  revenue: number
  orders: number
}

function RevenueReport() {
  const [year, setYear] = useState(2024)
  
  const {
    data: reportData,
    isLoading,
    error,
    execute,
    isExecuting
  } = useCustomQuery<ReportData>('monthly-revenue-report')

  const generateReport = async () => {
    await execute({ year })
  }

  return (
    <div>
      <div>
        <label>
          年:
          <input 
            type="number" 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))}
          />
        </label>
        <button onClick={generateReport} disabled={isExecuting}>
          {isExecuting ? 'レポート生成中...' : 'レポート生成'}
        </button>
      </div>

      {isLoading && <div>初期読み込み中...</div>}
      {error && <div>エラー: {error.message}</div>}

      {reportData.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th>売上</th>
              <th>注文数</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map(row => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>¥{row.revenue.toLocaleString()}</td>
                <td>{row.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

---

### ユーザー Hooks

#### useUser

エンドユーザー管理のフック。

**戻り値:**

```typescript
interface UseUserResult {
  users: User[]
  user: User | null
  isLoading: boolean
  error: Error | null
  list: (options?: QueryOptions) => Promise<void>
  get: (userId: string) => Promise<void>
  create: (userData: CreateUserData) => Promise<void>
  update: (userId: string, userData: Partial<CreateUserData>) => Promise<void>
  delete: (userId: string) => Promise<void>
  isCreating: boolean
  isUpdating: boolean
  isDeleting: boolean
}
```

**例:**

```tsx
import { useUser } from '@vibebase/react'

function UserManagement() {
  const {
    users,
    isLoading,
    error,
    list,
    create,
    update,
    delete: deleteUser,
    isCreating
  } = useUser()

  useEffect(() => {
    list() // ユーザー一覧を取得
  }, [list])

  const handleCreateUser = async () => {
    await create({
      username: 'new_user',
      email: 'new@example.com'
    })
    list() // 一覧を再取得
  }

  const handleUpdateUser = async (userId: string) => {
    await update(userId, {
      username: 'updated_username'
    })
    list() // 一覧を再取得
  }

  if (isLoading) return <div>読み込み中...</div>
  if (error) return <div>エラー: {error.message}</div>

  return (
    <div>
      <h2>ユーザー管理</h2>
      
      <button onClick={handleCreateUser} disabled={isCreating}>
        {isCreating ? '作成中...' : 'ユーザー作成'}
      </button>

      <div>
        {users.map(user => (
          <div key={user.id} style={{ 
            padding: '10px', 
            margin: '5px 0',
            border: '1px solid #ddd'
          }}>
            <strong>{user.username}</strong> - {user.email}
            <button onClick={() => handleUpdateUser(user.id)}>
              編集
            </button>
            <button onClick={() => deleteUser(user.id)}>
              削除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 🎯 型定義

### 共通レスポンス型

```typescript
interface VibebaseResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

### TableRow 基底型

```typescript
interface TableRow {
  id: string
  created_at: string
  updated_at: string
}
```

### エラーハンドリング

全てのAPI呼び出しは `VibebaseResponse<T>` を返します。以下のパターンでエラーハンドリングを行ってください：

```typescript
const response = await client.data.create('users', userData)

if (!response.success) {
  // エラー処理
  console.error('API Error:', response.error)
  return
}

// 成功時の処理
console.log('Success:', response.data)
```

### TypeScript 型の活用

インターフェースを定義して型安全性を確保：

```typescript
interface BlogPost extends TableRow {
  title: string
  content: string
  author_id: string
  published: boolean
  view_count: number
}

// 型付きでAPI呼び出し
const posts = await client.data.list<BlogPost>('blog_posts')
const { data: blogPosts } = useData<BlogPost>('blog_posts')
```

---

このAPIリファレンスで、Vibebase SDK の全ての機能を活用できます。不明な点があれば、[GitHub Issues](https://github.com/vibebase/vibebase/issues) で質問してください。