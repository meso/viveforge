import { beforeEach, describe, expect, it, vi } from 'vitest'

// Suppress console.error during tests to reduce noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

import { Hono } from 'hono'
import { storage } from '../routes/storage'
import type { Env, Variables } from '../types'

// Simple R2 mock for basic testing
interface SimpleMockR2Bucket {
  storage: Map<string, { data: ArrayBuffer; metadata: any }>
  get(key: string): Promise<any>
  put(key: string, value: ArrayBuffer, options?: any): Promise<any>
  delete(keys: string | string[]): Promise<void>
  list(options?: any): Promise<any>
  head(key: string): Promise<any>
}

function createSimpleMockR2Bucket(): SimpleMockR2Bucket {
  const storage = new Map<string, { data: ArrayBuffer; metadata: any }>()

  return {
    storage,

    async get(key: string) {
      const item = storage.get(key)
      if (!item) return null

      return {
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
        async arrayBuffer() {
          return item.data.slice()
        },
      }
    },

    async put(key: string, value: ArrayBuffer, options?: any) {
      const metadata = {
        key,
        size: value.byteLength,
        uploaded: new Date(),
        etag: Math.random().toString(36),
        httpEtag: `"${Math.random().toString(36)}"`,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      }

      storage.set(key, { data: value, metadata })
      return metadata
    },

    async delete(keys: string | string[]) {
      const keyArray = Array.isArray(keys) ? keys : [keys]
      keyArray.forEach((key) => storage.delete(key))
    },

    async list(options?: any) {
      const { prefix = '', limit = 1000 } = options || {}

      const objects = Array.from(storage.entries())
        .filter(([key]) => key.startsWith(prefix))
        .map(([_, item]) => item.metadata)
        .slice(0, limit)

      return {
        objects,
        truncated: false,
        delimitedPrefixes: [],
      }
    },

    async head(key: string) {
      const item = storage.get(key)
      return item ? item.metadata : null
    },
  }
}

describe('Storage API - Basic Tests', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let mockBucket: SimpleMockR2Bucket

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    mockBucket = createSimpleMockR2Bucket()

    app.use('*', async (c, next) => {
      c.env = {
        USER_STORAGE: mockBucket as any,
        ENVIRONMENT: 'development',
      } as Env
      await next()
    })

    app.route('/api/storage', storage)
  })

  describe('Basic functionality', () => {
    it('should list empty files initially', async () => {
      const res = await app.request('/api/storage')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.objects).toEqual([])
      expect(data.truncated).toBe(false)
    })

    it('should upload a file successfully', async () => {
      const formData = new FormData()
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.key).toBe('test.txt')
      expect(data.size).toBe(12)
    })

    it('should download uploaded file', async () => {
      // First upload a file
      const testData = new TextEncoder().encode('test content')
      await mockBucket.put('test.txt', testData, {
        httpMetadata: { contentType: 'text/plain' },
      })

      const res = await app.request('/api/storage/download/test.txt')
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/plain')

      const content = await res.text()
      expect(content).toBe('test content')
    })

    it('should delete a file successfully', async () => {
      // First upload a file
      const testData = new TextEncoder().encode('test content')
      await mockBucket.put('delete-me.txt', testData)

      const res = await app.request('/api/storage/delete-me.txt', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.success).toBe(true)

      // Verify file was deleted
      const deletedFile = await mockBucket.get('delete-me.txt')
      expect(deletedFile).toBeNull()
    })

    it('should get file info', async () => {
      // First upload a file
      const testData = new TextEncoder().encode('test content')
      await mockBucket.put('info-test.txt', testData, {
        httpMetadata: { contentType: 'text/plain' },
        customMetadata: { uploadedBy: 'test' },
      })

      const res = await app.request('/api/storage/info/info-test.txt')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.key).toBe('info-test.txt')
      expect(data.size).toBe(12)
      expect(data.customMetadata.uploadedBy).toBe('test')
    })

    it('should list uploaded files', async () => {
      // Upload some test files
      await mockBucket.put('file1.txt', new ArrayBuffer(10))
      await mockBucket.put('file2.txt', new ArrayBuffer(20))

      const res = await app.request('/api/storage')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.objects).toHaveLength(2)
      expect(data.objects.map((obj: any) => obj.key)).toContain('file1.txt')
      expect(data.objects.map((obj: any) => obj.key)).toContain('file2.txt')
    })

    it('should handle bulk delete', async () => {
      // Upload test files
      await mockBucket.put('bulk1.txt', new ArrayBuffer(10))
      await mockBucket.put('bulk2.txt', new ArrayBuffer(20))
      await mockBucket.put('keep.txt', new ArrayBuffer(30))

      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: ['bulk1.txt', 'bulk2.txt'] }),
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.success).toBe(true)
      expect(data.deletedKeys).toEqual(['bulk1.txt', 'bulk2.txt'])

      // Verify files were deleted
      expect(await mockBucket.get('bulk1.txt')).toBeNull()
      expect(await mockBucket.get('bulk2.txt')).toBeNull()
      expect(await mockBucket.get('keep.txt')).toBeTruthy()
    })
  })

  describe('Error cases', () => {
    it('should return 404 for non-existent file download', async () => {
      const res = await app.request('/api/storage/download/non-existent.txt')
      expect(res.status).toBe(404)
    })

    it('should return 404 for non-existent file info', async () => {
      const res = await app.request('/api/storage/info/non-existent.txt')
      expect(res.status).toBe(404)
    })

    it('should handle upload without file gracefully', async () => {
      const formData = new FormData()

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(400)
    })

    it('should handle invalid content type for upload', async () => {
      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })
  })
})
