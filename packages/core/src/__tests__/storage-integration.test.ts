import { beforeEach, describe, expect, it, vi } from 'vitest'

// Suppress console.error during tests to reduce noise
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

import { Hono } from 'hono'
import { storage } from '../routes/storage'
import type { Env, Variables } from '../types'

// Mock that simulates R2 failures
class FailingR2Bucket {
  private shouldFail: boolean = false
  private failureMessage: string = 'Simulated R2 failure'

  setFailureMode(shouldFail: boolean, message?: string) {
    this.shouldFail = shouldFail
    if (message) this.failureMessage = message
  }

  async get() {
    if (this.shouldFail) throw new Error(this.failureMessage)
    return null
  }

  async put(key: string, value: any) {
    if (this.shouldFail) throw new Error(this.failureMessage)
    return {
      key: key,
      size: value instanceof ArrayBuffer ? value.byteLength : value ? value.length || 0 : 0,
      uploaded: new Date(),
      etag: 'test-etag',
    }
  }

  async delete() {
    if (this.shouldFail) throw new Error(this.failureMessage)
  }

  async list() {
    if (this.shouldFail) throw new Error(this.failureMessage)
    return {
      objects: [],
      truncated: false,
      delimitedPrefixes: [],
    }
  }

  async head() {
    if (this.shouldFail) throw new Error(this.failureMessage)
    return null
  }
}

describe('Storage API Integration Tests', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>
  let failingBucket: FailingR2Bucket

  beforeEach(() => {
    app = new Hono<{ Bindings: Env; Variables: Variables }>()
    failingBucket = new FailingR2Bucket()

    app.use('*', async (c, next) => {
      c.env = {
        USER_STORAGE: failingBucket as any,
        ENVIRONMENT: 'development',
      } as Env
      await next()
    })

    app.route('/api/storage', storage)
  })

  describe('Error Handling', () => {
    it('should handle R2 list failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 list operation failed')

      const res = await app.request('/api/storage')
      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to list objects')
    })

    it('should handle R2 upload failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 put operation failed')

      const formData = new FormData()
      const file = new File(['test'], 'test.txt')
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to upload file')
    })

    it('should handle R2 download failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 get operation failed')

      const res = await app.request('/api/storage/download/test.txt')
      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to download file')
    })

    it('should handle R2 head failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 head operation failed')

      const res = await app.request('/api/storage/info/test.txt')
      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to get file info')
    })

    it('should handle R2 delete failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 delete operation failed')

      const res = await app.request('/api/storage/test.txt', {
        method: 'DELETE',
      })

      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to delete file')
    })

    it('should handle bulk delete failures gracefully', async () => {
      failingBucket.setFailureMode(true, 'R2 bulk delete operation failed')

      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: ['file1.txt', 'file2.txt'] }),
      })

      expect(res.status).toBe(500)

      const data = (await res.json()) as any
      expect(data.error.message).toBe('Failed to delete files')
    })
  })

  describe('Edge Cases', () => {
    beforeEach(() => {
      failingBucket.setFailureMode(false)
    })

    it('should handle very large file names', async () => {
      const longFileName = 'a'.repeat(1000) + '.txt'
      const formData = new FormData()
      const file = new File(['test'], longFileName)
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)
    })

    it('should handle files with no extension', async () => {
      const formData = new FormData()
      const file = new File(['test'], 'README')
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.key).toBe('README')
    })

    it('should handle empty files', async () => {
      const formData = new FormData()
      const file = new File([''], 'empty.txt')
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.size).toBe(0)
    })

    it('should handle unicode file names', async () => {
      const unicodeFileName = '日本語ファイル名.txt'
      const formData = new FormData()
      const file = new File(['unicode test'], unicodeFileName)
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.key).toBe(unicodeFileName)
    })

    it('should handle deeply nested paths', async () => {
      const deepPath = 'level1/level2/level3/level4/level5'
      const formData = new FormData()
      const file = new File(['deep file'], 'deep.txt')
      formData.append('file', file)
      formData.append('path', deepPath)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(data.key).toBe(`${deepPath}/deep.txt`)
    })

    it('should handle malformed JSON in bulk delete', async () => {
      const res = await app.request('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      })

      expect(res.status).toBe(400)
    })

    it('should handle missing Content-Type header in upload', async () => {
      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Invalid content type
        body: 'not-form-data',
      })

      expect(res.status).toBe(400)
      expect(((await res.json()) as any).error.message).toBe(
        'Content-Type must be multipart/form-data'
      )
    })
  })

  describe('Performance Edge Cases', () => {
    it('should handle requests with very high limits gracefully', async () => {
      const res = await app.request('/api/storage?limit=999999')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(Array.isArray(data.objects)).toBe(true)
    })

    it('should handle pagination with invalid cursor gracefully', async () => {
      const res = await app.request('/api/storage?cursor=invalid-cursor-value')
      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(Array.isArray(data.objects)).toBe(true)
    })

    it('should handle concurrent uploads gracefully', async () => {
      const uploadPromises = []

      for (let i = 0; i < 5; i++) {
        const formData = new FormData()
        const file = new File([`content ${i}`], `concurrent-${i}.txt`)
        formData.append('file', file)

        uploadPromises.push(
          app.request('/api/storage/upload', {
            method: 'POST',
            body: formData,
          })
        )
      }

      const results = await Promise.all(uploadPromises)

      // All uploads should succeed
      for (const res of results) {
        expect(res.status).toBe(200)
      }
    })
  })

  describe('Security Tests', () => {
    it('should prevent path traversal in file downloads', async () => {
      const maliciousKey = '../../../etc/passwd'
      const res = await app.request(`/api/storage/download/${encodeURIComponent(maliciousKey)}`)

      // Should return 404 since the file doesn't exist, not expose system files
      expect(res.status).toBe(404)
    })

    it('should handle null bytes in file names', async () => {
      const maliciousFileName = 'test\x00.txt'
      const formData = new FormData()
      const file = new File(['test'], maliciousFileName)
      formData.append('file', file)

      const res = await app.request('/api/storage/upload', {
        method: 'POST',
        body: formData,
      })

      // Should handle gracefully without crashing
      expect([200, 400]).toContain(res.status)
    })

    it('should handle extremely long prefixes', async () => {
      const longPrefix = 'a'.repeat(10000)
      const res = await app.request(`/api/storage?prefix=${encodeURIComponent(longPrefix)}`)

      expect(res.status).toBe(200)

      const data = (await res.json()) as any
      expect(Array.isArray(data.objects)).toBe(true)
    })
  })
})
