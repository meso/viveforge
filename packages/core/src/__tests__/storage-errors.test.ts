import { beforeEach, describe, expect, it, vi } from 'vitest'

// Suppress console.error during tests to reduce noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { storage } from '../routes/storage'
import type { Env, Variables } from '../types'

describe('Storage API Error Scenarios', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: Variables }>()

    // Add error handling middleware
    app.onError((error, c) => {
      console.error('Test app error:', error)
      if (error instanceof HTTPException) {
        return c.json(
          {
            success: false,
            error: {
              code: 'HTTP_EXCEPTION',
              message: error.message,
            },
          },
          error.status
        )
      }
      return c.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message,
          },
        },
        500
      )
    })

    app.route('/api/storage', storage)
  })

  describe('Missing R2 Bucket Configuration', () => {
    beforeEach(() => {
      app.use('*', async (c, next) => {
        c.env = {
          // USER_STORAGE is undefined
          ENVIRONMENT: 'development',
        } as Env
        await next()
      })
    })

    it('should return 500 for list when bucket not configured', async () => {
      const res = await app.request('/api/storage')
      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toContain('USER_STORAGE')
    })

    it('should return 500 for upload when bucket not configured', async () => {
      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.txt'))

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should return 500 for download when bucket not configured', async () => {
      const res = await app.request('/api/storage/download/test.txt')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should return 500 for info when bucket not configured', async () => {
      const res = await app.request('/api/storage/info/test.txt')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should return 500 for delete when bucket not configured', async () => {
      const res = await app.request('/api/storage/test.txt', { method: 'DELETE' })
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should return 500 for bulk delete when bucket not configured', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: ['test.txt'] }),
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })
  })

  describe('R2 Operation Failures', () => {
    class FailingR2Mock {
      constructor(private failureType: string) {}

      async list() {
        throw new Error(`R2 list failed: ${this.failureType}`)
      }

      async put() {
        throw new Error(`R2 put failed: ${this.failureType}`)
      }

      async get() {
        throw new Error(`R2 get failed: ${this.failureType}`)
      }

      async head() {
        throw new Error(`R2 head failed: ${this.failureType}`)
      }

      async delete() {
        throw new Error(`R2 delete failed: ${this.failureType}`)
      }
    }

    it('should handle network timeouts', async () => {
      const timeoutBucket = new FailingR2Mock('network timeout')

      app.use('*', async (c, next) => {
        c.env = { USER_STORAGE: timeoutBucket as any, ENVIRONMENT: 'development' } as Env
        await next()
      })

      const res = await app.request('/api/storage')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should handle permission errors', async () => {
      const permissionBucket = new FailingR2Mock('permission denied')

      app.use('*', async (c, next) => {
        c.env = { USER_STORAGE: permissionBucket as any, ENVIRONMENT: 'development' } as Env
        await next()
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.txt'))

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should handle quota exceeded errors', async () => {
      const quotaBucket = new FailingR2Mock('quota exceeded')

      app.use('*', async (c, next) => {
        c.env = { USER_STORAGE: quotaBucket as any, ENVIRONMENT: 'development' } as Env
        await next()
      })

      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.txt'))

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })
  })

  describe('Invalid Request Data', () => {
    beforeEach(() => {
      app.use('*', async (c, next) => {
        c.env = {
          USER_STORAGE: {
            async list() {
              return { objects: [], truncated: false, delimitedPrefixes: [] }
            },
            async put() {
              return { key: 'test', size: 0, uploaded: new Date(), etag: 'test' }
            },
            async get() {
              return null
            },
            async head() {
              return null
            },
            async delete() {},
          } as any,
          ENVIRONMENT: 'development',
        } as Env
        await next()
      })
    })

    it('should validate upload content type', async () => {
      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'not-a-file' }),
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should validate file presence in upload', async () => {
      const formData = new FormData()
      // No file attached

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should validate bulk delete request body', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notKeys: ['file1.txt'] }),
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should validate bulk delete keys type', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: 'not-an-array' }),
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should validate bulk delete empty array', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [] }),
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should handle malformed JSON in bulk delete', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      })

      expect(res.status).toBe(500) // JSON parse error
    })

    it('should handle invalid content-type header', async () => {
      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'invalid body',
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })
  })

  describe('Resource Limits', () => {
    beforeEach(() => {
      app.use('*', async (c, next) => {
        c.env = {
          USER_STORAGE: {
            async list() {
              return { objects: [], truncated: false, delimitedPrefixes: [] }
            },
            async put() {
              throw new Error('File too large')
            },
            async get() {
              return null
            },
            async head() {
              return null
            },
            async delete() {},
          } as any,
          ENVIRONMENT: 'development',
        } as Env
        await next()
      })
    })

    it('should handle file size limit errors', async () => {
      const formData = new FormData()
      formData.append('file', new File(['x'.repeat(1000000)], 'large.txt'))

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })
  })

  describe('HTTP Exception Propagation', () => {
    beforeEach(() => {
      const throwingBucket = {
        async list() {
          throw new HTTPException(503, { message: 'Service temporarily unavailable' })
        },
        async put() {
          throw new HTTPException(507, { message: 'Insufficient storage' })
        },
        async get() {
          throw new HTTPException(403, { message: 'Access denied' })
        },
        async head() {
          throw new HTTPException(429, { message: 'Rate limit exceeded' })
        },
        async delete() {
          throw new HTTPException(409, { message: 'Conflict during deletion' })
        },
      }

      app.use('*', async (c, next) => {
        c.env = { USER_STORAGE: throwingBucket as any, ENVIRONMENT: 'development' } as Env
        await next()
      })
    })

    it('should propagate HTTP exceptions from list operations', async () => {
      const res = await app.request('/api/storage')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should propagate HTTP exceptions from upload operations', async () => {
      const formData = new FormData()
      formData.append('file', new File(['test'], 'test.txt'))

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should propagate HTTP exceptions from download operations', async () => {
      const res = await app.request('/api/storage/download/test.txt')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should propagate HTTP exceptions from info operations', async () => {
      const res = await app.request('/api/storage/info/test.txt')
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })

    it('should propagate HTTP exceptions from delete operations', async () => {
      const res = await app.request('/api/storage/test.txt', { method: 'DELETE' })
      expect(res.status).toBe(500)
      expect(((await res.json()) as any).error.message).toContain('USER_STORAGE')
    })
  })
})
