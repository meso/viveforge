import type { R2Bucket } from '@cloudflare/workers-types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Suppress console.error during tests to reduce noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

import { Hono } from 'hono'
import { storage } from '../routes/storage'
import type { Env, Variables } from '../types'
import { createMockEnv } from './helpers/mock-env'

// Type definitions for test responses
interface StorageListResponse {
  success: boolean
  data: {
    files: Array<{
      name: string
      size: number
      contentType: string
      lastModified?: string
      metadata?: Record<string, string>
    }>
    truncated?: boolean
    cursor?: string
  }
}

interface StorageFileResponse {
  success: boolean
  data: {
    name: string
    size: number
    contentType: string
    lastModified?: string
    uploaded_at?: string
    etag?: string
    metadata?: Record<string, string>
  }
}

interface StorageErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

// interface StorageUrlResponse {
//   success: boolean
//   data: {
//     url: string
//   }
// }

interface StorageSuccessResponse {
  success: boolean
  data?: {
    message?: string
  }
  message?: string
  deletedKeys?: string[]
}

// Enhanced R2 mock for storage tests
interface MockR2Object {
  key: string
  size: number
  uploaded: Date
  etag: string
  httpEtag: string
  httpMetadata?: {
    contentType?: string
    contentLanguage?: string
    contentDisposition?: string
    contentEncoding?: string
    cacheControl?: string
  }
  customMetadata?: Record<string, string>
  body?: ReadableStream
  text(): Promise<string>
  json<T = unknown>(): Promise<T>
  arrayBuffer(): Promise<ArrayBuffer>
  blob(): Promise<Blob>
}

interface MockR2Bucket {
  storage: Map<string, { data: ArrayBuffer; metadata: MockR2Object }>
  get(key: string): Promise<MockR2Object | null>
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
  ): Promise<MockR2Object>
  delete(keys: string | string[]): Promise<void>
  list(options?: unknown): Promise<{
    objects: MockR2Object[]
    truncated: boolean
    cursor?: string
    delimitedPrefixes: string[]
  }>
  head(key: string): Promise<MockR2Object | null>
}

function createMockR2Bucket(): MockR2Bucket {
  const storage = new Map<string, { data: ArrayBuffer; metadata: MockR2Object }>()

  return {
    storage,

    async get(key: string) {
      const item = storage.get(key)
      if (!item) return null

      const mockObject: MockR2Object = {
        ...item.metadata,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(item.data))
            controller.close()
          },
        }),
        async text() {
          return new TextDecoder().decode(item.data)
        },
        async json<T = unknown>(): Promise<T> {
          const text = await this.text()
          return JSON.parse(text) as T
        },
        async arrayBuffer() {
          return item.data.slice()
        },
        async blob() {
          return new Blob([item.data], { type: item.metadata.httpMetadata?.contentType })
        },
      }
      return mockObject
    },

    async put(
      key: string,
      value: ArrayBuffer,
      options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }
    ) {
      const metadata: MockR2Object = {
        key,
        size: value.byteLength,
        uploaded: new Date(),
        etag: Math.random().toString(36),
        httpEtag: `"${Math.random().toString(36)}"`,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
        text: async () => new TextDecoder().decode(value),
        json: async <T = unknown>(): Promise<T> => {
          const text = new TextDecoder().decode(value)
          return JSON.parse(text) as T
        },
        arrayBuffer: async () => value.slice(),
        blob: async () => new Blob([value], { type: options?.httpMetadata?.contentType }),
      }

      storage.set(key, { data: value, metadata })
      return metadata
    },

    async delete(keys: string | string[]) {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      keyArray.forEach((key) => storage.delete(key))
    },

    async list(options?: Record<string, unknown>) {
      const { prefix = '', limit = 1000, cursor } = options || {}

      let objects = Array.from(storage.entries())
        .filter(([key]) => key.startsWith(prefix as string))
        .map(([_, item]) => item.metadata)
        .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())

      // Simple cursor pagination simulation
      if (cursor) {
        const cursorIndex = objects.findIndex((obj) => obj.key === (cursor as string))
        if (cursorIndex >= 0) {
          objects = objects.slice(cursorIndex + 1)
        }
      }

      const truncated = objects.length > (limit as number)
      if (truncated) {
        objects = objects.slice(0, limit as number)
      }

      return {
        objects,
        truncated,
        cursor: truncated ? objects[objects.length - 1]?.key : undefined,
        delimitedPrefixes: [],
      }
    },

    async head(key: string) {
      const item = storage.get(key)
      return item ? item.metadata : null
    },
  }
}

describe('Storage API', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockR2Bucket: MockR2Bucket

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    mockR2Bucket = createMockR2Bucket()

    // Set up environment
    app.use('*', async (c, next) => {
      c.env = {
        ...createMockEnv(),
        USER_STORAGE: mockR2Bucket as unknown as R2Bucket,
      } as unknown as Env
      await next()
    })

    app.route('/api/storage', storage)
  })

  describe('GET /', () => {
    it('should return empty list when no files exist', async () => {
      const res = await app.request('/api/storage/files')
      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data.files).toEqual([])
      expect(data.data.truncated).toBe(false)
    })

    it('should list files when they exist', async () => {
      // Add test files
      const testData = new TextEncoder().encode('test content')
      await mockR2Bucket.put('test.txt', testData, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { originalName: 'test.txt' },
      })

      const res = await app.request('/api/storage/files')
      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data.files).toHaveLength(1)
      expect(data.data.files[0]).toMatchObject({
        name: 'test.txt',
        size: testData.byteLength,
        contentType: 'text/plain',
      })
    })

    it('should filter by prefix when provided', async () => {
      // Add test files
      await mockR2Bucket.put('images/photo1.jpg', new ArrayBuffer(100))
      await mockR2Bucket.put('images/photo2.jpg', new ArrayBuffer(200))
      await mockR2Bucket.put('documents/doc1.pdf', new ArrayBuffer(300))

      const res = await app.request('/api/storage/files?prefix=images/')
      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data.files).toHaveLength(2)
      expect(data.data.files.every((obj) => obj.name.startsWith('images/'))).toBe(true)
    })

    it('should handle pagination with limit and cursor', async () => {
      // Add test files
      for (let i = 0; i < 5; i++) {
        await mockR2Bucket.put(`file${i}.txt`, new ArrayBuffer(100))
      }

      const res = await app.request('/api/storage/files?limit=2')
      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data.files).toHaveLength(2)
      expect(data.data.truncated).toBe(true)
      expect(data.data.cursor).toBeDefined()
    })

    it('should return 500 when R2 bucket not configured', async () => {
      const tempApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      tempApp.use('*', async (c, next) => {
        c.env = { ...createMockEnv() } as Env
        await next()
      })
      tempApp.route('/api/storage', storage)

      const res = await tempApp.request('/api/storage/files')
      expect(res.status).toBe(500)

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('R2 bucket not configured')
    })
  })

  describe('POST /upload', () => {
    it('should upload a file successfully', async () => {
      const formData = new FormData()
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)

      const res = await app.request('/api/storage/files', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        name: 'test.txt',
        size: 12, // 'test content'.length
        etag: expect.any(String),
      })

      // Verify file was stored
      const storedFile = await mockR2Bucket.get('test.txt')
      expect(storedFile).toBeTruthy()
      expect(await storedFile?.text()).toBe('test content')
    })

    it('should upload file with custom path', async () => {
      const formData = new FormData()
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)
      formData.append('path', 'uploads/documents')

      const res = await app.request('/api/storage/files', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageFileResponse
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('uploads/documents/test.txt')
    })

    it('should return 400 when no file provided', async () => {
      const formData = new FormData()

      const res = await app.request('/api/storage/files', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(400)

      try {
        const data = (await res.json()) as StorageErrorResponse
        expect(data.success).toBe(false)
        expect(data.error.message).toBe('No file provided')
      } catch {
        // Response might not be JSON in error cases
        const text = await res.text()
        expect(text).toContain('No file provided')
      }
    })

    it('should return 400 for invalid content type', async () => {
      const res = await app.request('/api/storage/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('Content-Type must be multipart/form-data')
    })

    it('should return 500 when R2 bucket not configured', async () => {
      const tempApp = new Hono<{ Bindings: Env; Variables: Variables }>()
      tempApp.use('*', async (c, next) => {
        c.env = { ...createMockEnv(), USER_STORAGE: undefined } as Env // USER_STORAGE is undefined
        await next()
      })
      tempApp.route('/api/storage', storage)

      const formData = new FormData()
      const file = new File(['test'], 'test.txt')
      formData.append('file', file)

      const res = await tempApp.request('/api/storage/files', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
    })
  })

  describe('GET /download/:key', () => {
    beforeEach(async () => {
      // Add test file
      const testData = new TextEncoder().encode('test file content')
      await mockR2Bucket.put('test-download.txt', testData, {
        httpMetadata: {
          contentType: 'text/plain',
          contentLanguage: 'en',
          cacheControl: 'max-age=3600',
        },
      })
    })

    it('should download file successfully', async () => {
      const res = await app.request('/api/storage/files/test-download.txt/content')
      expect(res.status).toBe(200)

      expect(res.headers.get('Content-Type')).toBe('text/plain')
      expect(res.headers.get('Content-Language')).toBe('en')
      expect(res.headers.get('Cache-Control')).toBe('max-age=3600')
      expect(res.headers.get('Content-Length')).toBe('17')

      const content = await res.text()
      expect(content).toBe('test file content')
    })

    it('should return 404 for non-existent file', async () => {
      const res = await app.request('/api/storage/files/non-existent.txt/content')
      expect(res.status).toBe(404)

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('File not found')
    })

    it('should handle files with special characters in key', async () => {
      const specialKey = 'folder/file with spaces & symbols!.txt'
      const testData = new TextEncoder().encode('special file')
      await mockR2Bucket.put(specialKey, testData)

      const encodedKey = encodeURIComponent(specialKey)
      const res = await app.request(`/api/storage/files/${encodedKey}/content`)
      expect(res.status).toBe(200)

      const content = await res.text()
      expect(content).toBe('special file')
    })
  })

  describe('GET /info/:key', () => {
    beforeEach(async () => {
      const testData = new TextEncoder().encode('test content')
      await mockR2Bucket.put('info-test.txt', testData, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { uploadedBy: 'test-user' },
      })
    })

    it('should return file info successfully', async () => {
      const res = await app.request('/api/storage/files/info-test.txt')
      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageFileResponse
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        name: 'info-test.txt',
        size: 12,
        contentType: 'text/plain',
        metadata: { uploadedBy: 'test-user' },
      })
      expect(data.data.lastModified).toBeDefined()
      expect(data.data.etag).toBeDefined()
    })

    it('should return 404 for non-existent file', async () => {
      const res = await app.request('/api/storage/files/non-existent.txt')
      expect(res.status).toBe(404)

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('File not found')
    })
  })

  describe('DELETE /:key', () => {
    beforeEach(async () => {
      const testData = new TextEncoder().encode('to be deleted')
      await mockR2Bucket.put('delete-test.txt', testData)
    })

    it('should delete file successfully', async () => {
      const res = await app.request('/api/storage/files/delete-test.txt', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageListResponse
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        message: 'File deleted successfully',
      })

      // Verify file was deleted
      const deletedFile = await mockR2Bucket.get('delete-test.txt')
      expect(deletedFile).toBeNull()
    })

    it('should handle deletion of non-existent file gracefully', async () => {
      const res = await app.request('/api/storage/files/non-existent.txt', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404) // File not found

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('File not found')
    })
  })

  describe('DELETE / (bulk delete)', () => {
    beforeEach(async () => {
      // Add multiple test files
      for (let i = 1; i <= 3; i++) {
        const testData = new TextEncoder().encode(`file ${i} content`)
        await mockR2Bucket.put(`bulk-test-${i}.txt`, testData)
      }
    })

    it('should delete multiple files successfully', async () => {
      const keys = ['bulk-test-1.txt', 'bulk-test-2.txt']

      const res = await app.request('/api/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as StorageSuccessResponse
      expect(data.success).toBe(true)
      expect(data.message).toBe('2 files deleted successfully')
      expect(data.deletedKeys).toEqual(keys)

      // Verify files were deleted
      for (const key of keys) {
        const deletedFile = await mockR2Bucket.get(key)
        expect(deletedFile).toBeNull()
      }

      // Verify remaining file still exists
      const remainingFile = await mockR2Bucket.get('bulk-test-3.txt')
      expect(remainingFile).toBeTruthy()
    })

    it('should return 400 when keys array is empty', async () => {
      const res = await app.request('/api/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [] }),
      })

      expect(res.status).toBe(400)

      const data = (await res.json()) as StorageErrorResponse
      expect(data.success).toBe(false)
      expect(data.error.message).toBe('Keys array is required')
    })

    it('should return 400 when keys is not an array', async () => {
      const res = await app.request('/api/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: 'not-an-array' }),
      })

      expect(res.status).toBe(400)
    })

    it('should return 400 when keys is missing', async () => {
      const res = await app.request('/api/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })
  })
})
