# Vibebase API Documentation

## Dynamic CRUD API

Vibebase automatically generates RESTful CRUD endpoints for all user-created tables. System tables (`admins`, `sessions`) are protected and cannot be accessed through this API.

### Base URL
```
https://your-worker.your-domain.workers.dev/api/data
```

### Authentication

The Vibebase API supports multiple authentication methods to accommodate different use cases:

#### 1. Admin Authentication (Dashboard)
For accessing the management dashboard and administrative functions:
- **Method**: GitHub OAuth → JWT tokens
- **Usage**: Dashboard login, admin operations
- **Token**: Long-lived JWT with admin privileges

#### 2. API Key Authentication (Server-to-Server)
For backend services and server-side applications:
- **Method**: API Keys generated in dashboard
- **Usage**: Server-side integrations, scheduled jobs
- **Header**: `Authorization: Bearer <api_key>`
- **Security**: Should only be used in secure server environments

#### 3. End-User OAuth Authentication (Client Applications)
For mobile apps and frontend applications with end users:
- **Method**: OAuth (GitHub, Google, Discord, etc.) → Access tokens
- **Usage**: Mobile apps, SPAs, desktop applications
- **Token**: Short-lived access tokens (in-memory only)
- **Security**: Tokens expire automatically, no persistent storage

#### Authentication Flow for Client Applications

1. **User Authentication**:
   ```javascript
   // User logs in via OAuth (GitHub/Google/Discord)
   const { accessToken } = await vibebaseAuth.login('github')
   ```

2. **API Access**:
   ```javascript
   // Use the access token for API calls
   fetch('/api/data/users', {
     headers: {
       'Authorization': `Bearer ${accessToken}`
     }
   })
   ```

3. **Token Management**:
   - Tokens are kept in memory only (never persisted)
   - Automatic refresh when needed
   - App restart requires re-authentication

#### Authorization Levels

**Admin**: Full access to all data and management functions
**End User**: Access based on user-specific permissions and data ownership
**API Key**: Configurable scopes (read-only, write, specific tables, etc.)

#### Security Best Practices

- **Never embed API keys in client applications**
- **Use OAuth flow for end-user facing applications**
- **Keep access tokens in memory only**
- **Implement proper logout to clear tokens**

---

## Endpoints

### 1. List Records
Get all records from a table with pagination and sorting.

**Endpoint:** `GET /api/data/:tableName`

**Query Parameters:**
- `page` (optional): Page number, default: 1
- `limit` (optional): Records per page (1-100), default: 20
- `sortBy` (optional): Field to sort by, default: 'created_at'
- `sortOrder` (optional): 'asc' or 'desc', default: 'desc'

**Example:**
```bash
curl "https://vibebase.mesongo.workers.dev/api/data/users?page=1&limit=10&sortBy=name&sortOrder=asc"
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  },
  "sort": {
    "by": "name",
    "order": "asc"
  }
}
```

### 2. Get Single Record
Retrieve a specific record by ID.

**Endpoint:** `GET /api/data/:tableName/:id`

**Example:**
```bash
curl "https://vibebase.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319"
```

**Response:**
```json
{
  "data": {
    "id": "95437d9618c32dbf7d349584498c2319",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2025-06-12 13:18:10",
    "updated_at": "2025-06-12 13:18:10"
  }
}
```

### 3. Create Record
Create a new record in the table.

**Endpoint:** `POST /api/data/:tableName`

**Body:** JSON object with field values

**Example:**
```bash
curl -X POST "https://vibebase.mesongo.workers.dev/api/data/users" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "name": "New User"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "generated-id",
    "email": "newuser@example.com",
    "name": "New User"
  },
  "message": "Record created successfully"
}
```

### 4. Update Record
Update an existing record.

**Endpoint:** `PUT /api/data/:tableName/:id`

**Body:** JSON object with fields to update

**Example:**
```bash
curl -X PUT "https://vibebase.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "95437d9618c32dbf7d349584498c2319",
    "email": "user@example.com",
    "name": "Updated Name",
    "created_at": "2025-06-12 13:18:10",
    "updated_at": "2025-06-13T05:33:34.556Z"
  },
  "message": "Record updated successfully"
}
```

### 5. Delete Record
Delete a record from the table.

**Endpoint:** `DELETE /api/data/:tableName/:id`

**Example:**
```bash
curl -X DELETE "https://vibebase.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319"
```

**Response:**
```json
{
  "success": true,
  "message": "Record deleted successfully"
}
```

---

## Validation

### Automatic Type Validation
The API automatically validates data types based on your table schema:

- **INTEGER**: Must be a valid integer
- **REAL**: Must be a valid number
- **TEXT**: Must be a string
- **BOOLEAN**: Must be true/false or 0/1
- **BLOB**: Accepts any value

### Required Fields
Fields marked as `NOT NULL` in your table schema are required when creating records.

### Foreign Key Constraints
Foreign key relationships are automatically enforced. You cannot:
- Insert records with invalid foreign key references
- Delete records that are referenced by other tables

---

## Error Responses

All errors return appropriate HTTP status codes with descriptive messages:

### 404 - Not Found
```json
{
  "error": "Table 'tablename' not found"
}
```

```json
{
  "error": "Record with id 'invalid-id' not found"
}
```

### 403 - Forbidden
```json
{
  "error": "Cannot access system table 'admins'"
}
```

### 400 - Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    "Field 'email' is required",
    "Field 'age' must be an integer"
  ]
}
```

### 500 - Internal Server Error
```json
{
  "error": "Failed to fetch data"
}
```

---

## System Tables

The following tables are protected and cannot be accessed via the Dynamic CRUD API:
- `admins`: Dashboard admin users
- `sessions`: Authentication sessions

---

## Table Management API

For managing table schemas, use the Table Management API:

### List Tables
```bash
curl "https://vibebase.mesongo.workers.dev/api/tables"
```

### Get Table Schema
```bash
curl "https://vibebase.mesongo.workers.dev/api/tables/users/schema"
```

### Create Table
```bash
curl -X POST "https://vibebase.mesongo.workers.dev/api/tables" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "products",
    "columns": [
      {"name": "title", "type": "TEXT", "constraints": "NOT NULL"},
      {"name": "price", "type": "REAL"},
      {"name": "category_id", "type": "TEXT", "foreignKey": {"table": "categories", "column": "id"}}
    ]
  }'
```

---

## Rate Limits

Currently, no rate limits are implemented. This may be added in future versions.

---

## Search API

Search records in a table by specific column values. Only indexed columns of TEXT or INTEGER type can be searched.

### 6. Search Records
Search for records matching specific criteria.

**Endpoint:** `GET /api/tables/:tableName/search`

**Query Parameters:**
- `column` (required): Column name to search (must be indexed TEXT or INTEGER)
- `operator` (required): Search operator
  - For TEXT: `eq`, `is_null`, `is_not_null`
  - For INTEGER: `eq`, `lt`, `le`, `gt`, `ge`, `ne`, `is_null`, `is_not_null`
- `value` (required for non-null operators): Value to search for
- `limit` (optional): Maximum number of results, default: all matching records
- `offset` (optional): Number of records to skip, default: 0

**Examples:**
```bash
# Search for users with exact name match
curl "https://vibebase.mesongo.workers.dev/api/tables/users/search?column=name&operator=eq&value=John"

# Search for users older than 25
curl "https://vibebase.mesongo.workers.dev/api/tables/users/search?column=age&operator=gt&value=25&limit=50&offset=0"

# Search for users with null email
curl "https://vibebase.mesongo.workers.dev/api/tables/users/search?column=email&operator=is_null"
```

**Success Response:**
```json
{
  "data": [
    {
      "id": "abc123",
      "name": "John",
      "age": 30,
      "email": "john@example.com"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  },
  "query": {
    "table": "users",
    "column": "name",
    "operator": "eq",
    "value": "John"
  }
}
```

### Search Error Responses

**Column Not Searchable:**
```json
{
  "error": {
    "code": "COLUMN_NOT_SEARCHABLE",
    "message": "Column 'email' is not searchable (no index found)",
    "details": {
      "table": "users",
      "column": "email",
      "searchableColumns": ["id", "name", "age"]
    }
  }
}
```

**Invalid Operator:**
```json
{
  "error": {
    "code": "INVALID_OPERATOR",
    "message": "Operator 'like' is not supported for TEXT columns",
    "details": {
      "column": "name",
      "columnType": "TEXT",
      "supportedOperators": ["eq", "is_null", "is_not_null"]
    }
  }
}
```

**Type Mismatch:**
```json
{
  "error": {
    "code": "TYPE_MISMATCH",
    "message": "Invalid value type for INTEGER column",
    "details": {
      "column": "age",
      "expectedType": "INTEGER",
      "receivedValue": "not_a_number"
    }
  }
}
```

**System Table Access:**
```json
{
  "error": {
    "code": "SYSTEM_TABLE_ACCESS_DENIED",
    "message": "Search is not allowed on system table 'admins'"
  }
}
```

### Search Constraints

1. **Indexed Columns Only**: Only columns with database indexes can be searched
2. **System Tables**: Search is prohibited on system tables (`admins`, `sessions`, `schema_snapshots`, etc.)
3. **Supported Types**: Only TEXT and INTEGER columns are searchable
4. **Case Sensitivity**: TEXT searches are case-sensitive (SQLite default behavior)
5. **Performance**: All searches use indexes for optimal performance

---

---

## Implementation Roadmap

### Phase 1: Multi-Authentication Support ✅ Completed
- ✅ Admin authentication (GitHub OAuth + JWT)
- ✅ API Key authentication for server-side applications
- ✅ Multi-authentication middleware supporting both Admin JWT and API Keys
- ✅ Scope-based authorization for API Keys
- ✅ API Key management in dashboard (create, revoke, scope configuration)
- ✅ Comprehensive test coverage (100% pass rate)
- 📋 End-user OAuth authentication for client applications

### Phase 2: Enhanced Security & Management (In Progress)
- ✅ API Key management UI with full CRUD operations
- ✅ System table protection for authentication tables
- 📋 User management and permissions for end-users
- 📋 Rate limiting and usage analytics
- 📋 Audit logs for all API access
- 📋 API Key usage tracking and analytics

### Phase 3: Advanced Features
- 📋 Field-level permissions
- 📋 **Complex search with multiple conditions**: POST-based search API with support for combining multiple column conditions using AND/OR logic (e.g., `name = 'John' AND age > 25`)
- 📋 Bulk operations (batch create, update, delete)
- 📋 Webhooks for data changes
- 📋 Real-time subscriptions via WebSockets/SSE
- 📋 GraphQL API support
- 📋 Advanced query builder UI

### Phase 4: Production Features
- 📋 Monitoring and observability
- 📋 Performance optimization
- 📋 Data export/import tools
- 📋 Backup and disaster recovery
- 📋 Multi-environment support (dev/staging/prod)

### Current Status: API Key Authentication Complete
The API Key authentication system is fully implemented and deployed with:
- **Multi-auth middleware**: Supports both Admin JWT and API Key authentication
- **Scope-based permissions**: Configurable access control (data:*, tables:*, storage:*)
- **Dashboard management**: Full UI for creating, viewing, and revoking API keys
- **Security**: SHA256 hashing, secure key generation, system table protection
- **Testing**: 100% test coverage with comprehensive test suite

### Legend
- ✅ Completed
- 🚧 In Development  
- 📋 Planned