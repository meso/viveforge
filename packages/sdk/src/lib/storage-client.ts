/**
 * Storage Client for file operations
 */

import type { ApiResponse, FileInfo, FileUploadOptions } from '../types'
import type { HttpClient } from './http-client'

export class StorageClient {
  constructor(private http: HttpClient) {}

  /**
   * Upload a file
   */
  async upload(
    file: File | Blob,
    fileName: string,
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileInfo>> {
    const formData = new FormData()
    formData.append('file', file, fileName)

    if (options?.contentType) {
      formData.append('content_type', options.contentType)
    }

    if (options?.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata))
    }

    // Override content-type for multipart/form-data
    const headers: Record<string, string> = {}
    // Don't set Content-Type, let browser set it with boundary

    return this.http.request<FileInfo>('/api/storage/upload', {
      method: 'POST',
      body: formData,
      headers,
    })
  }

  /**
   * Get file info
   */
  async getInfo(fileName: string): Promise<ApiResponse<FileInfo>> {
    return this.http.get<FileInfo>(`/api/storage/files/${encodeURIComponent(fileName)}`)
  }

  /**
   * Get file download URL
   */
  async getDownloadUrl(
    fileName: string,
    expiresIn?: number
  ): Promise<
    ApiResponse<{
      url: string
      expires_at: string
    }>
  > {
    const params: Record<string, string> = {}
    if (expiresIn) params.expires_in = String(expiresIn)

    return this.http.get(`/api/storage/files/${encodeURIComponent(fileName)}/url`, params)
  }

  /**
   * Delete a file
   */
  async delete(fileName: string): Promise<ApiResponse<void>> {
    return this.http.delete(`/api/storage/files/${encodeURIComponent(fileName)}`)
  }

  /**
   * List files
   */
  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<
    ApiResponse<{
      files: FileInfo[]
      cursor?: string
      has_more: boolean
    }>
  > {
    const params: Record<string, string> = {}
    if (options?.prefix) params.prefix = options.prefix
    if (options?.limit) params.limit = String(options.limit)
    if (options?.cursor) params.cursor = options.cursor

    return this.http.get('/api/storage/files', params)
  }

  /**
   * Copy a file
   */
  async copy(sourceFileName: string, destinationFileName: string): Promise<ApiResponse<FileInfo>> {
    return this.http.post('/api/storage/copy', {
      source: sourceFileName,
      destination: destinationFileName,
    })
  }

  /**
   * Move a file
   */
  async move(sourceFileName: string, destinationFileName: string): Promise<ApiResponse<FileInfo>> {
    return this.http.post('/api/storage/move', {
      source: sourceFileName,
      destination: destinationFileName,
    })
  }

  /**
   * Get storage usage statistics
   */
  async getUsage(): Promise<
    ApiResponse<{
      total_files: number
      total_size: number
      quota: number
      used_percentage: number
    }>
  > {
    return this.http.get('/api/storage/usage')
  }

  /**
   * Upload from URL
   */
  async uploadFromUrl(
    url: string,
    fileName: string,
    options?: FileUploadOptions
  ): Promise<ApiResponse<FileInfo>> {
    return this.http.post('/api/storage/upload-from-url', {
      url,
      file_name: fileName,
      content_type: options?.contentType,
      metadata: options?.metadata,
    })
  }

  /**
   * Generate presigned upload URL
   */
  async createPresignedUpload(
    fileName: string,
    contentType: string,
    expiresIn?: number
  ): Promise<
    ApiResponse<{
      upload_url: string
      file_url: string
      expires_at: string
      fields?: Record<string, string>
    }>
  > {
    return this.http.post('/api/storage/presigned-upload', {
      file_name: fileName,
      content_type: contentType,
      expires_in: expiresIn,
    })
  }
}
