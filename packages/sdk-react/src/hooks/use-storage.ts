/**
 * Storage operations hook
 */

import type { FileInfo, FileUploadOptions } from '@vibebase/sdk'
import { useCallback } from 'react'
import { useVibebase } from '../providers/vibebase-provider'
import { useMutation } from './use-mutation'

interface UseStorageResult {
  upload: (file: File, fileName?: string, options?: FileUploadOptions) => Promise<FileInfo>
  getDownloadUrl: (fileName: string, expiresIn?: number) => Promise<string>
  getInfo: (fileName: string) => Promise<FileInfo>
  delete: (fileName: string) => Promise<void>
  list: () => Promise<FileInfo[]>
  isUploading: boolean
  isDeleting: boolean
  error: Error | null
}

export function useStorage(): UseStorageResult {
  const { client } = useVibebase()

  // Upload mutation
  const uploadMutation = useMutation(
    async ({
      file,
      fileName,
      options,
    }: {
      file: File
      fileName: string
      options?: FileUploadOptions
    }) => {
      const response = await client.storage.upload(file, fileName, options)
      if (!response.success) {
        throw new Error(response.error || 'Failed to upload file')
      }
      return response.data || ({} as FileInfo)
    }
  )

  // Delete mutation
  const deleteMutation = useMutation(async (fileName: string) => {
    const response = await client.storage.delete(fileName)
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete file')
    }
  })

  // Wrapper functions
  const upload = useCallback(
    async (file: File, fileName?: string, options?: FileUploadOptions) => {
      const finalFileName = fileName || file.name
      return uploadMutation.mutateAsync({ file, fileName: finalFileName, options })
    },
    [uploadMutation]
  )

  const getDownloadUrl = useCallback(
    async (fileName: string, expiresIn?: number) => {
      const response = await client.storage.getDownloadUrl(fileName, expiresIn)
      if (!response.success) {
        throw new Error(response.error || 'Failed to get download URL')
      }
      return response.data?.url || ''
    },
    [client]
  )

  const deleteFile = useCallback(
    async (fileName: string) => {
      await deleteMutation.mutateAsync(fileName)
    },
    [deleteMutation]
  )

  const getInfo = useCallback(
    async (fileName: string) => {
      const response = await client.storage.getInfo(fileName)
      if (!response.success) {
        throw new Error(response.error || 'Failed to get file info')
      }
      return response.data || ({} as FileInfo)
    },
    [client]
  )

  const list = useCallback(async () => {
    const response = await client.storage.list()
    if (!response.success) {
      throw new Error(response.error || 'Failed to list files')
    }
    return response.data?.files || []
  }, [client])

  return {
    upload,
    getDownloadUrl,
    getInfo,
    delete: deleteFile,
    list,
    isUploading: uploadMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
    error: uploadMutation.error || deleteMutation.error,
  }
}
