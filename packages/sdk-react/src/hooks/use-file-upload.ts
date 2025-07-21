/**
 * File upload hook with progress tracking
 */

import type { FileInfo, FileUploadOptions } from '@vibebase/sdk'
import { useCallback, useState } from 'react'
import { useVibebase } from '../providers/vibebase-provider'
import type { UploadProgress, UseFileUploadResult } from '../types'

export function useFileUpload(): UseFileUploadResult {
  const { client } = useVibebase()
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setIsUploading(false)
    setProgress(null)
    setError(null)
  }, [])

  const upload = useCallback(
    async (file: File, fileName?: string, options?: FileUploadOptions): Promise<FileInfo> => {
      try {
        setIsUploading(true)
        setError(null)
        setProgress({
          loaded: 0,
          total: file.size,
          percentage: 0,
        })

        // Note: The current SDK doesn't support progress tracking
        // This is a placeholder for future implementation
        // For now, we'll simulate progress
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (!prev) return null
            const newPercentage = Math.min(prev.percentage + 10, 90)
            return {
              loaded: (file.size * newPercentage) / 100,
              total: file.size,
              percentage: newPercentage,
            }
          })
        }, 100)

        const finalFileName = fileName || file.name
        const response = await client.storage.upload(finalFileName, file, options)

        clearInterval(progressInterval)

        if (!response.success) {
          throw new Error(response.error || 'Failed to upload file')
        }

        setProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
        })

        return response.data || ({} as FileInfo)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed')
        setError(error)
        throw error
      } finally {
        setIsUploading(false)
      }
    },
    [client]
  )

  const uploadMultiple = useCallback(
    async (files: File[], options?: FileUploadOptions): Promise<FileInfo[]> => {
      try {
        setIsUploading(true)
        setError(null)

        const totalSize = files.reduce((sum, file) => sum + file.size, 0)
        let uploadedSize = 0

        setProgress({
          loaded: 0,
          total: totalSize,
          percentage: 0,
        })

        const results: FileInfo[] = []

        for (const file of files) {
          const response = await client.storage.upload(file.name, file, options)

          if (!response.success) {
            throw new Error(response.error || `Failed to upload ${file.name}`)
          }

          results.push(response.data || ({} as FileInfo))
          uploadedSize += file.size

          setProgress({
            loaded: uploadedSize,
            total: totalSize,
            percentage: Math.round((uploadedSize / totalSize) * 100),
          })
        }

        return results
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed')
        setError(error)
        throw error
      } finally {
        setIsUploading(false)
      }
    },
    [client]
  )

  return {
    upload,
    uploadMultiple,
    isUploading,
    progress,
    error,
    reset,
  }
}
