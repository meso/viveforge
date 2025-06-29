# @vibebase/sdk

TypeScript SDK for Vibebase - Personal BaaS on Cloudflare

## Installation

```bash
npm install @vibebase/sdk
# or
yarn add @vibebase/sdk
# or
pnpm add @vibebase/sdk
```

## Quick Start

```typescript
import { createClient } from '@vibebase/sdk'

const vibebase = createClient({
  apiUrl: 'https://your-app.workers.dev',
  apiKey: 'your-api-key', // or userToken for user authentication
})

// Health check
const health = await vibebase.health()
console.log(health.data) // { status: 'ok', timestamp: '...', version: '...' }
```

## Authentication

### API Key Authentication (Server-side)
```typescript
const vibebase = createClient({
  apiUrl: 'https://your-app.workers.dev',
  apiKey: 'vb_your_api_key_here',
})
```

### User Authentication (Client-side)
```typescript
const vibebase = createClient({
  apiUrl: 'https://your-app.workers.dev',
})

// OAuth login
const loginUrl = await vibebase.auth.loginWithProvider('github')
window.location.href = loginUrl

// After OAuth callback, set the user token
vibebase.setUserToken('user_jwt_token')

// Check current user
const user = await vibebase.auth.getCurrentUser()
console.log(user.data) // { id, email, name, ... }
```

## Data Operations

### Basic CRUD
```typescript
// Create a record
const todo = await vibebase.data.create('todos', {
  title: 'Learn Vibebase SDK',
  completed: false,
})

// List records
const todos = await vibebase.data.list('todos', {
  limit: 10,
  orderBy: 'created_at',
  orderDirection: 'desc',
})

// Get a single record
const todo = await vibebase.data.get('todos', 'todo-id')

// Update a record
const updated = await vibebase.data.update('todos', 'todo-id', {
  completed: true,
})

// Delete a record
await vibebase.data.delete('todos', 'todo-id')
```

### Advanced Queries
```typescript
// Search records
const results = await vibebase.data.search('todos', 'important', {
  limit: 5,
})

// Query with filters
const todos = await vibebase.data.list('todos', {
  where: { completed: false },
  limit: 20,
  offset: 0,
})

// Execute raw SQL (admin only)
const result = await vibebase.executeSQL(
  'SELECT * FROM todos WHERE created_at > ?',
  ['2023-01-01']
)
```

### Bulk Operations
```typescript
// Bulk insert
const records = await vibebase.data.bulkInsert('todos', [
  { title: 'Task 1', completed: false },
  { title: 'Task 2', completed: false },
])

// Bulk update
await vibebase.data.bulkUpdate('todos', [
  { id: 'todo-1', data: { completed: true } },
  { id: 'todo-2', data: { completed: true } },
])

// Bulk delete
await vibebase.data.bulkDelete('todos', ['todo-1', 'todo-2'])
```

## Realtime Subscriptions

```typescript
// Subscribe to table changes
const subscription = vibebase.realtime.subscribe(
  'todos',
  'insert',
  (event) => {
    console.log('New todo created:', event.record)
  }
)

// Subscribe to all events on a table
const allEvents = vibebase.realtime.subscribe(
  'todos',
  '*',
  (event) => {
    console.log(`Todo ${event.type}:`, event.record)
  }
)

// Unsubscribe
subscription.unsubscribe()

// Or unsubscribe from all
vibebase.realtime.unsubscribeAll()
```

## File Storage

```typescript
// Upload a file
const fileInput = document.querySelector('input[type="file"]')
const file = fileInput.files[0]

const result = await vibebase.storage.upload(file, 'my-image.jpg', {
  contentType: 'image/jpeg',
  metadata: { userId: 'user-123' },
})

// Get file info
const info = await vibebase.storage.getInfo('my-image.jpg')

// Get download URL
const download = await vibebase.storage.getDownloadUrl('my-image.jpg')
console.log(download.data.url) // Presigned URL

// List files
const files = await vibebase.storage.list({
  prefix: 'uploads/',
  limit: 50,
})

// Delete file
await vibebase.storage.delete('my-image.jpg')
```

## Custom Queries

```typescript
// List available custom queries
const queries = await vibebase.customQueries.list()

// Execute a custom query
const result = await vibebase.customQueries.execute('user-stats', {
  start_date: '2023-01-01',
  end_date: '2023-12-31',
})

// Execute by name/slug
const analytics = await vibebase.customQueries.executeByName('monthly-analytics', {
  month: '2023-12',
})
```

## Error Handling

```typescript
const result = await vibebase.data.create('todos', {
  title: 'New todo',
})

if (!result.success) {
  console.error('Error:', result.error)
  console.log('Status:', result.status)
} else {
  console.log('Created:', result.data)
}
```

## TypeScript Support

The SDK is fully typed and provides excellent IntelliSense support:

```typescript
import type { TableRow, User, FileInfo } from '@vibebase/sdk'

// Define your table types
interface Todo extends TableRow {
  title: string
  completed: boolean
  user_id: string
}

// Type-safe operations
const todos = await vibebase.data.list<Todo>('todos')
const todo = await vibebase.data.create<Todo>('todos', {
  title: 'Typed todo',
  completed: false,
  user_id: 'user-123',
})
```

## Configuration Options

```typescript
const vibebase = createClient({
  apiUrl: 'https://your-app.workers.dev',
  apiKey: 'your-api-key',           // Optional: API key for server-side
  userToken: 'user-jwt-token',       // Optional: User token for client-side
  timeout: 30000,                    // Optional: Request timeout (default: 30s)
  retries: 3,                        // Optional: Number of retries (default: 3)
})
```

## Examples

Check out the [examples directory](../../examples/) for complete sample applications:

- **Todo App**: Basic CRUD operations with realtime updates
- **File Manager**: File upload and management
- **Chat App**: Realtime messaging with user authentication

## License

Elastic License 2.0