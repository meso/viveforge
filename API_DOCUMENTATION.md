# Viveforge API Documentation

## Dynamic CRUD API

Viveforge automatically generates RESTful CRUD endpoints for all user-created tables. System tables (`admins`, `sessions`) are protected and cannot be accessed through this API.

### Base URL
```
https://your-worker.your-domain.workers.dev/api/data
```

### Authentication
Currently, the Dynamic CRUD API does not require authentication. This will be added in future versions.

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
curl "https://viveforge-core.mesongo.workers.dev/api/data/users?page=1&limit=10&sortBy=name&sortOrder=asc"
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
curl "https://viveforge-core.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319"
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
curl -X POST "https://viveforge-core.mesongo.workers.dev/api/data/users" \
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
curl -X PUT "https://viveforge-core.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319" \
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
curl -X DELETE "https://viveforge-core.mesongo.workers.dev/api/data/users/95437d9618c32dbf7d349584498c2319"
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
curl "https://viveforge-core.mesongo.workers.dev/api/tables"
```

### Get Table Schema
```bash
curl "https://viveforge-core.mesongo.workers.dev/api/tables/users/schema"
```

### Create Table
```bash
curl -X POST "https://viveforge-core.mesongo.workers.dev/api/tables" \
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

## Coming Soon

- Authentication and authorization
- Field-level permissions
- Query filtering and search
- Bulk operations
- Webhooks for data changes
- Real-time subscriptions