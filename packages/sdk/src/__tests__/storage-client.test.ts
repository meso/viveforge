import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HttpClient } from '../lib/http-client'
import { StorageClient } from '../lib/storage-client'

describe('StorageClient', () => {
  let storageClient: StorageClient
  let mockHttpClient: jest.Mocked<HttpClient>

  beforeEach(() => {
    mockHttpClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    } as jest.Mocked<HttpClient>

    storageClient = new StorageClient(mockHttpClient)
  })

  describe('upload', () => {
    it('should upload a file', async () => {
      const fileName = 'test.txt'
      const file = new Blob(['test content'], { type: 'text/plain' })
      const options = {
        contentType: 'text/plain',
        metadata: { purpose: 'test' },
      }
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/test.txt',
          metadata: { purpose: 'test' },
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.request.mockResolvedValue(mockResponse)

      const result = await storageClient.upload(fileName, file, options)

      expect(mockHttpClient.request).toHaveBeenCalledWith('/api/storage/files', {
        method: 'POST',
        body: expect.stringContaining('Content-Disposition: form-data; name="file"'),
        headers: expect.objectContaining({
          'Content-Type': expect.stringContaining('multipart/form-data'),
        }),
      })
      expect(result).toEqual(mockResponse)
    })

    it('should upload a file without options', async () => {
      const fileName = 'test.txt'
      const file = new Blob(['test content'], { type: 'text/plain' })
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/test.txt',
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.request.mockResolvedValue(mockResponse)

      const result = await storageClient.upload(fileName, file)

      expect(mockHttpClient.request).toHaveBeenCalledWith('/api/storage/files', {
        method: 'POST',
        body: expect.stringContaining('Content-Disposition: form-data; name="file"'),
        headers: expect.objectContaining({
          'Content-Type': expect.stringContaining('multipart/form-data'),
        }),
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getInfo', () => {
    it('should get file info', async () => {
      const fileName = 'test.txt'
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/test.txt',
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getInfo(fileName)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt')
      expect(result).toEqual(mockResponse)
    })

    it('should encode special characters in file names', async () => {
      const fileName = 'file with spaces & special chars.txt'
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/file%20with%20spaces%20%26%20special%20chars.txt',
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getInfo(fileName)

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/api/storage/files/file%20with%20spaces%20%26%20special%20chars.txt'
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getDownloadUrl', () => {
    it('should get download URL', async () => {
      const fileName = 'test.txt'
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/test.txt?signature=abc123',
          expires_at: '2023-01-01T01:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getDownloadUrl(fileName)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt/url', {})
      expect(result).toEqual(mockResponse)
    })

    it('should get download URL with expiration', async () => {
      const fileName = 'test.txt'
      const expiresIn = 3600
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/test.txt?signature=abc123',
          expires_at: '2023-01-01T01:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getDownloadUrl(fileName, expiresIn)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt/url', {
        expires_in: '3600',
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('delete', () => {
    it('should delete a file', async () => {
      const fileName = 'test.txt'
      const mockResponse = {
        success: true,
        status: 200,
      }
      mockHttpClient.delete.mockResolvedValue(mockResponse)

      const result = await storageClient.delete(fileName)

      expect(mockHttpClient.delete).toHaveBeenCalledWith('/api/storage/files/test.txt')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('list', () => {
    it('should list files without filters', async () => {
      const mockResponse = {
        success: true,
        data: {
          files: [
            {
              name: 'test1.txt',
              size: 12,
              contentType: 'text/plain',
              url: '/storage/test1.txt',
              uploaded_at: '2023-01-01T00:00:00Z',
            },
            {
              name: 'test2.txt',
              size: 15,
              contentType: 'text/plain',
              url: '/storage/test2.txt',
              uploaded_at: '2023-01-01T00:01:00Z',
            },
          ],
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.list()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files', {})
      expect(result.data).toEqual(mockResponse.data.files)
    })

    it('should list files with prefix filter', async () => {
      const prefix = 'test-'
      const mockResponse = {
        success: true,
        data: {
          files: [
            {
              name: 'test-1.txt',
              size: 12,
              contentType: 'text/plain',
              url: '/storage/test-1.txt',
              uploaded_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.list(prefix)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files', { prefix })
      expect(result.data).toEqual(mockResponse.data.files)
    })

    it('should list files with extension filter', async () => {
      const extension = '.json'
      const mockResponse = {
        success: true,
        data: {
          files: [
            {
              name: 'data.json',
              size: 50,
              contentType: 'application/json',
              url: '/storage/data.json',
              uploaded_at: '2023-01-01T00:00:00Z',
            },
          ],
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.list(undefined, extension)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files', { extension })
      expect(result.data).toEqual(mockResponse.data.files)
    })

    it('should list files with both prefix and extension filters', async () => {
      const prefix = 'test-'
      const extension = '.json'
      const mockResponse = {
        success: true,
        data: { files: [] },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.list(prefix, extension)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files', { prefix, extension })
      expect(result.data).toEqual([])
    })
  })

  describe('copy', () => {
    it('should copy a file', async () => {
      const sourceFileName = 'source.txt'
      const destinationFileName = 'destination.txt'
      const mockResponse = {
        success: true,
        data: {
          name: destinationFileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/destination.txt',
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await storageClient.copy(sourceFileName, destinationFileName)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/storage/copy', {
        source: sourceFileName,
        destination: destinationFileName,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('move', () => {
    it('should move a file', async () => {
      const sourceFileName = 'source.txt'
      const destinationFileName = 'destination.txt'
      const mockResponse = {
        success: true,
        data: {
          name: destinationFileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/destination.txt',
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await storageClient.move(sourceFileName, destinationFileName)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/storage/move', {
        source: sourceFileName,
        destination: destinationFileName,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getUsage', () => {
    it('should get storage usage statistics', async () => {
      const mockResponse = {
        success: true,
        data: {
          total_files: 10,
          total_size: 1024,
          quota: 10240,
          used_percentage: 10,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getUsage()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/usage')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('uploadFromUrl', () => {
    it('should upload file from URL', async () => {
      const url = 'https://example.com/file.txt'
      const fileName = 'downloaded-file.txt'
      const options = {
        contentType: 'text/plain',
        metadata: { source: 'external' },
      }
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 100,
          contentType: 'text/plain',
          url: '/storage/downloaded-file.txt',
          metadata: { source: 'external' },
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 201,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await storageClient.uploadFromUrl(url, fileName, options)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/storage/upload-from-url', {
        url,
        file_name: fileName,
        content_type: options.contentType,
        metadata: options.metadata,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createPresignedUpload', () => {
    it('should create presigned upload URL', async () => {
      const fileName = 'test.txt'
      const contentType = 'text/plain'
      const expiresIn = 3600
      const mockResponse = {
        success: true,
        data: {
          upload_url: 'https://storage.example.com/upload?signature=abc123',
          file_url: 'https://storage.example.com/test.txt',
          expires_at: '2023-01-01T01:00:00Z',
          fields: {
            key: 'test.txt',
            'Content-Type': 'text/plain',
          },
        },
        status: 200,
      }
      mockHttpClient.post.mockResolvedValue(mockResponse)

      const result = await storageClient.createPresignedUpload(fileName, contentType, expiresIn)

      expect(mockHttpClient.post).toHaveBeenCalledWith('/api/storage/presigned-upload', {
        file_name: fileName,
        content_type: contentType,
        expires_in: expiresIn,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('download', () => {
    it('should get download URL', async () => {
      const fileName = 'test.txt'
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/test.txt?signature=abc123',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.download(fileName)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt/download')
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getPresignedUrl', () => {
    it('should get presigned URL for download', async () => {
      const fileName = 'test.txt'
      const action = 'download'
      const expiresIn = 3600
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/test.txt?signature=abc123',
          expires_at: '2023-01-01T01:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getPresignedUrl(fileName, action, expiresIn)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt/presigned-url', {
        action,
        expires_in: '3600',
      })
      expect(result).toEqual(mockResponse)
    })

    it('should get presigned URL for upload', async () => {
      const fileName = 'test.txt'
      const action = 'upload'
      const mockResponse = {
        success: true,
        data: {
          url: 'https://storage.example.com/upload/test.txt?signature=xyz789',
          expires_at: '2023-01-01T01:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getPresignedUrl(fileName, action)

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/files/test.txt/presigned-url', {
        action,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('updateMetadata', () => {
    it('should update file metadata', async () => {
      const fileName = 'test.txt'
      const metadata = { purpose: 'updated', version: '2.0' }
      const mockResponse = {
        success: true,
        data: {
          name: fileName,
          size: 12,
          contentType: 'text/plain',
          url: '/storage/test.txt',
          metadata,
          uploaded_at: '2023-01-01T00:00:00Z',
        },
        status: 200,
      }
      mockHttpClient.patch.mockResolvedValue(mockResponse)

      const result = await storageClient.updateMetadata(fileName, metadata)

      expect(mockHttpClient.patch).toHaveBeenCalledWith('/api/storage/files/test.txt/metadata', {
        metadata,
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getStats', () => {
    it('should get storage statistics', async () => {
      const mockResponse = {
        success: true,
        data: {
          total_files: 25,
          total_size: 2048,
          quota: 10240,
          used_percentage: 20,
        },
        status: 200,
      }
      mockHttpClient.get.mockResolvedValue(mockResponse)

      const result = await storageClient.getStats()

      expect(mockHttpClient.get).toHaveBeenCalledWith('/api/storage/stats')
      expect(result).toEqual(mockResponse)
    })
  })
})
