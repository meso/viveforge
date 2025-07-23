import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env, Variables } from '../types'
import { ErrorCode } from '../types/errors'

// Response types for Storage API
interface StorageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

interface FileInfo {
  name: string
  contentType: string
  size: number
  uploaded_at?: string
  lastModified?: string
  etag?: string
  metadata?: Record<string, string>
  url?: string
}

const storage = new Hono<{ Bindings: Env; Variables: Variables }>()

// Helper function for consistent error responses
const errorResponse = (
  c: Context<{ Bindings: Env; Variables: Variables }>,
  status: number,
  code: string,
  message: string
) => {
  return c.json(
    {
      success: false,
      error: { code, message },
    },
    status as 400 | 403 | 404 | 500
  )
}

// ファイル一覧取得
storage.get('/files', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const { prefix, limit = 100, cursor, extension } = c.req.query()

  try {
    const result = await bucket.list({
      prefix,
      limit: parseInt(limit.toString()),
      cursor,
    })

    let filteredFiles = result.objects.map((obj) => ({
      name: obj.key,
      size: obj.size,
      contentType: obj.httpMetadata?.contentType || 'application/octet-stream',
      lastModified: obj.uploaded?.toISOString(),
      metadata: obj.customMetadata,
    }))

    // Apply extension filter if provided
    if (extension) {
      const ext = extension.startsWith('.') ? extension : `.${extension}`
      filteredFiles = filteredFiles.filter((file) => file.name.endsWith(ext))
    }

    return c.json({
      success: true,
      data: {
        files: filteredFiles,
        truncated: result.truncated,
        cursor: result.truncated ? result.objects[result.objects.length - 1]?.key : undefined,
      },
    })
  } catch (error) {
    console.error('Error listing objects:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to list objects')
  }
})

// ファイルアップロード
storage.post('/files', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const contentType = c.req.header('content-type')

  // More lenient Content-Type check for development/testing
  if (
    !contentType ||
    (!contentType.toLowerCase().includes('multipart/form-data') &&
      !contentType.toLowerCase().includes('text/plain'))
  ) {
    return errorResponse(
      c,
      400,
      ErrorCode.VALIDATION_FAILED,
      `Content-Type must be multipart/form-data, received: ${contentType}`
    )
  }

  try {
    const formData = await c.req.formData()

    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'No file provided')
    }

    // Validate file name
    const fileObj = file as File
    const fileName = fileObj.name
    if (!fileName || fileName.trim() === '') {
      return errorResponse(
        c,
        400,
        ErrorCode.VALIDATION_FAILED,
        'Invalid file name: File name cannot be empty'
      )
    }

    // Check for dangerous path traversal patterns
    if (fileName.includes('..') || fileName.includes('\\')) {
      return errorResponse(
        c,
        400,
        ErrorCode.VALIDATION_FAILED,
        'Invalid file name: Path traversal patterns are not allowed'
      )
    }

    const path = (formData.get('path') as string) || ''
    const contentType = (formData.get('content_type') as string) || ''
    const metadataString = (formData.get('metadata') as string) || ''

    // Parse metadata from form data
    let customMetadata: Record<string, string> = {
      originalName: (file as File).name,
      uploadedAt: new Date().toISOString(),
    }

    if (metadataString) {
      try {
        const parsedMetadata = JSON.parse(metadataString)
        if (parsedMetadata && typeof parsedMetadata === 'object') {
          customMetadata = { ...customMetadata, ...parsedMetadata }
        }
      } catch (error) {
        console.warn('Failed to parse metadata:', error)
      }
    }

    const key = path ? `${path}/${fileObj.name}` : fileObj.name
    const buffer = await fileObj.arrayBuffer()

    const result = await bucket.put(key, buffer, {
      httpMetadata: {
        contentType: contentType || fileObj.type || 'application/octet-stream',
      },
      customMetadata,
    })

    return c.json({
      success: true,
      data: {
        name: result.key,
        url: `/api/storage/files/${encodeURIComponent(result.key)}`,
        size: result.size,
        contentType: fileObj.type || 'application/octet-stream',
        lastModified: result.uploaded?.toISOString(),
        etag: result.etag,
        metadata: result.customMetadata || {},
      },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    if (error instanceof HTTPException) {
      return errorResponse(c, error.status, ErrorCode.STORAGE_OPERATION_FAILED, error.message)
    }
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to upload file')
  }
})

// バイナリ直接アップロード（S3スタイル）
storage.put('/files/:fileName', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  try {
    const fileName = c.req.param('fileName')

    if (!fileName || fileName.trim() === '') {
      return errorResponse(
        c,
        400,
        ErrorCode.VALIDATION_FAILED,
        'Invalid file name: File name cannot be empty'
      )
    }

    // Check for dangerous path traversal patterns
    if (fileName.includes('..') || fileName.includes('\\')) {
      return errorResponse(
        c,
        400,
        ErrorCode.VALIDATION_FAILED,
        'Invalid file name: Path traversal patterns are not allowed'
      )
    }

    // Get binary data from request body
    const arrayBuffer = await c.req.arrayBuffer()
    const contentType = c.req.header('content-type') || 'application/octet-stream'

    // Get metadata from headers (prefixed with x-metadata-)
    const customMetadata: Record<string, string> = {}
    for (const [key, value] of Object.entries(c.req.header())) {
      if (key.startsWith('x-metadata-')) {
        const metadataKey = key.substring('x-metadata-'.length)
        customMetadata[metadataKey] = value as string
      }
    }

    // Add default metadata
    customMetadata.originalName = fileName
    customMetadata.uploadedAt = new Date().toISOString()

    // Upload to R2
    const uploadResult = await bucket.put(fileName, arrayBuffer, {
      customMetadata,
      httpMetadata: {
        contentType,
      },
    })

    // Get file URL
    const host = c.req.header('host') || c.env.WORKER_DOMAIN || 'localhost:8787'
    const protocol =
      c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`
    const fileUrl = `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}`

    const response: StorageResponse<FileInfo> = {
      success: true,
      data: {
        name: fileName,
        url: fileUrl,
        size: arrayBuffer.byteLength,
        contentType,
        lastModified: uploadResult.uploaded.toISOString(),
        etag: uploadResult.etag,
        metadata: customMetadata,
      },
    }

    return c.json(response, 201)
  } catch (error) {
    console.error('Error uploading file (binary):', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to upload file')
  }
})

// ファイルダウンロードURL取得
storage.get('/files/:fileName/download', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  try {
    // ファイルの存在確認
    const object = await bucket.head(fileName)
    if (!object) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    // ダウンロードURLを返す（実際のファイル取得は別エンドポイント）
    const host = c.req.header('host') || c.env.WORKER_DOMAIN || 'localhost:8787'
    const protocol =
      c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`

    return c.json({
      success: true,
      data: {
        url: `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}/content`,
      },
    })
  } catch (error) {
    console.error('Error generating download URL:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to generate download URL'
    )
  }
})

// 実際のファイル内容取得（新エンドポイント）
storage.get('/files/:fileName/content', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  try {
    const object = await bucket.get(fileName)
    if (!object) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    const headers = new Headers()
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType)
    }
    if (object.httpMetadata?.contentLanguage) {
      headers.set('Content-Language', object.httpMetadata.contentLanguage)
    }
    if (object.httpMetadata?.contentDisposition) {
      headers.set('Content-Disposition', object.httpMetadata.contentDisposition)
    }
    if (object.httpMetadata?.contentEncoding) {
      headers.set('Content-Encoding', object.httpMetadata.contentEncoding)
    }
    if (object.httpMetadata?.cacheControl) {
      headers.set('Cache-Control', object.httpMetadata.cacheControl)
    }

    headers.set('Content-Length', object.size.toString())
    headers.set('ETag', object.httpEtag)
    headers.set('Last-Modified', object.uploaded.toUTCString())

    return new Response(object.body, { headers })
  } catch (error) {
    console.error('Error downloading file:', error)
    if (error instanceof HTTPException) {
      return errorResponse(c, error.status, ErrorCode.STORAGE_OPERATION_FAILED, error.message)
    }
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to download file')
  }
})

// ファイル情報取得
storage.get('/files/:fileName', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  try {
    const object = await bucket.head(fileName)
    if (!object) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    return c.json({
      success: true,
      data: {
        name: fileName,
        size: object.size,
        contentType: object.httpMetadata?.contentType || 'application/octet-stream',
        lastModified: object.uploaded?.toISOString(),
        uploaded_at: object.uploaded?.toISOString(),
        etag: object.etag,
        metadata: object.customMetadata || {},
      },
    })
  } catch (error) {
    console.error('Error getting file info:', error)
    if (error instanceof HTTPException) {
      return errorResponse(c, error.status, ErrorCode.STORAGE_OPERATION_FAILED, error.message)
    }
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to get file info')
  }
})

// ファイル削除
storage.delete('/files/:fileName', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  try {
    // Check if file exists before deleting
    const existing = await bucket.head(fileName)
    if (!existing) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    await bucket.delete(fileName)
    return c.json({
      success: true,
      data: {
        message: 'File deleted successfully',
      },
    })
  } catch (error) {
    console.error('Error deleting file:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to delete file')
  }
})

// 複数ファイル削除
storage.delete('/files', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  let keys: string[]
  try {
    const body = (await c.req.json()) as { keys: string[] }
    keys = body.keys
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Keys array is required')
  }

  try {
    await bucket.delete(keys)
    return c.json({
      success: true,
      message: `${keys.length} files deleted successfully`,
      deletedKeys: keys,
    })
  } catch (error) {
    console.error('Error deleting files:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to delete files')
  }
})

// 不足しているエンドポイントを追加

// GET /api/storage/files/:fileName/url - Get signed URL for file download
storage.get('/files/:fileName/url', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  const expiresIn = c.req.query('expires_in')

  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  try {
    // R2では事前署名URLは直接生成する機能がないため、ダウンロードURLを返す
    const expirationTime = expiresIn
      ? new Date(Date.now() + parseInt(expiresIn) * 1000)
      : new Date(Date.now() + 3600000) // 1時間デフォルト

    const host = c.req.header('host') || c.env.WORKER_DOMAIN || 'localhost:8787'
    const protocol =
      c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`

    return c.json({
      success: true,
      data: {
        url: `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}/content`,
        expires_at: expirationTime.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to generate presigned URL'
    )
  }
})

// GET /api/storage/files/:fileName/presigned-url - Get presigned URL with action
storage.get('/files/:fileName/presigned-url', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  const action = c.req.query('action')
  const expiresIn = c.req.query('expires_in')

  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  if (!action || (action !== 'upload' && action !== 'download')) {
    return errorResponse(
      c,
      400,
      ErrorCode.VALIDATION_FAILED,
      'Action must be "upload" or "download"'
    )
  }

  try {
    const expirationTime = expiresIn
      ? new Date(Date.now() + parseInt(expiresIn) * 1000)
      : new Date(Date.now() + 3600000)

    const host = c.req.header('host') || c.env.WORKER_DOMAIN || 'localhost:8787'
    const protocol =
      c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`

    const url =
      action === 'upload'
        ? `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}/upload`
        : `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}/content`

    return c.json({
      success: true,
      data: {
        url,
        expires_at: expirationTime.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to generate presigned URL'
    )
  }
})

// PATCH /api/storage/files/:fileName/metadata - Update file metadata
storage.patch('/files/:fileName/metadata', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  const fileName = c.req.param('fileName')
  if (!fileName || fileName.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File name is required')
  }

  let metadata: Record<string, string>
  try {
    const body = (await c.req.json()) as { metadata: Record<string, string> }
    metadata = body.metadata
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!metadata || typeof metadata !== 'object') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Metadata is required')
  }

  try {
    // ファイルの存在確認
    const existingObject = await bucket.head(fileName)
    if (!existingObject) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    // メタデータの更新のため、既存ファイルを再アップロード
    const fileObject = await bucket.get(fileName)
    if (!fileObject) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    const updatedMetadata = {
      ...existingObject.customMetadata,
      ...metadata,
      updatedAt: new Date().toISOString(),
    }

    // ファイルを同じ内容で再アップロード（メタデータ更新のため）
    const result = await bucket.put(fileName, await fileObject.arrayBuffer(), {
      httpMetadata: existingObject.httpMetadata,
      customMetadata: updatedMetadata,
    })

    return c.json({
      success: true,
      data: {
        name: fileName,
        size: result.size,
        contentType: existingObject.httpMetadata?.contentType || 'application/octet-stream',
        lastModified: result.uploaded?.toISOString(),
        etag: result.etag,
        metadata: updatedMetadata,
      },
    })
  } catch (error) {
    console.error('Error updating file metadata:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to update file metadata'
    )
  }
})

// POST /api/storage/copy - Copy a file
storage.post('/copy', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  let source: string, destination: string
  try {
    const body = (await c.req.json()) as { source: string; destination: string }
    source = body.source
    destination = body.destination
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!source || !destination) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Source and destination are required')
  }

  try {
    // ソースファイルの取得
    const sourceObject = await bucket.get(source)
    if (!sourceObject) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'Source file not found')
    }

    // ソースファイルのメタデータ取得
    const sourceHead = await bucket.head(source)
    if (!sourceHead) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'Source file metadata not found')
    }

    // 宛先にファイルをコピー
    const result = await bucket.put(destination, await sourceObject.arrayBuffer(), {
      httpMetadata: sourceHead.httpMetadata,
      customMetadata: {
        ...sourceHead.customMetadata,
        copiedFrom: source,
        copiedAt: new Date().toISOString(),
      },
    })

    return c.json({
      success: true,
      data: {
        name: destination,
        size: result.size,
        contentType: sourceHead.httpMetadata?.contentType || 'application/octet-stream',
        lastModified: result.uploaded?.toISOString(),
        etag: result.etag,
        metadata: result.customMetadata || {},
      },
    })
  } catch (error) {
    console.error('Error copying file:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to copy file')
  }
})

// POST /api/storage/move - Move a file
storage.post('/move', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  let source: string, destination: string
  try {
    const body = (await c.req.json()) as { source: string; destination: string }
    source = body.source
    destination = body.destination
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!source || !destination) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Source and destination are required')
  }

  try {
    // ソースファイルの取得
    const sourceObject = await bucket.get(source)
    if (!sourceObject) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'Source file not found')
    }

    // ソースファイルのメタデータ取得
    const sourceHead = await bucket.head(source)
    if (!sourceHead) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'Source file metadata not found')
    }

    // 宛先にファイルをコピー
    const result = await bucket.put(destination, await sourceObject.arrayBuffer(), {
      httpMetadata: sourceHead.httpMetadata,
      customMetadata: {
        ...sourceHead.customMetadata,
        movedFrom: source,
        movedAt: new Date().toISOString(),
      },
    })

    // ソースファイルを削除
    await bucket.delete(source)

    return c.json({
      success: true,
      data: {
        name: destination,
        size: result.size,
        contentType: sourceHead.httpMetadata?.contentType || 'application/octet-stream',
        lastModified: result.uploaded?.toISOString(),
        etag: result.etag,
        metadata: result.customMetadata || {},
      },
    })
  } catch (error) {
    console.error('Error moving file:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to move file')
  }
})

// GET /api/storage/usage - Get storage usage statistics
storage.get('/usage', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  try {
    // R2では使用量統計を直接取得できないので、ファイルリストから計算
    const result = await bucket.list({ limit: 1000 })

    let totalSize = 0
    const totalFiles = result.objects.length

    for (const obj of result.objects) {
      totalSize += obj.size
    }

    // 仮のクォータ（実際のプロジェクトでは設定可能にする）
    const quota = 1024 * 1024 * 1024 * 10 // 10GB
    const usedPercentage = Math.round((totalSize / quota) * 100)

    return c.json({
      success: true,
      data: {
        total_files: totalFiles,
        total_size: totalSize,
        quota,
        used_percentage: usedPercentage,
      },
    })
  } catch (error) {
    console.error('Error getting storage usage:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to get storage usage')
  }
})

// GET /api/storage/stats - Get storage statistics (alias for usage)
storage.get('/stats', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  try {
    const result = await bucket.list({ limit: 1000 })

    let totalSize = 0
    const totalFiles = result.objects.length

    for (const obj of result.objects) {
      totalSize += obj.size
    }

    const quota = 1024 * 1024 * 1024 * 10 // 10GB
    const usedPercentage = Math.round((totalSize / quota) * 100)

    return c.json({
      success: true,
      data: {
        total_files: totalFiles,
        total_size: totalSize,
        quota,
        used_percentage: usedPercentage,
      },
    })
  } catch (error) {
    console.error('Error getting storage stats:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to get storage stats')
  }
})

// POST /api/storage/upload-from-url - Upload from URL
storage.post('/upload-from-url', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  let url: string,
    fileName: string,
    contentType: string | undefined,
    metadata: Record<string, string> | undefined
  try {
    const body = (await c.req.json()) as {
      url: string
      file_name: string
      content_type?: string
      metadata?: Record<string, string>
    }
    url = body.url
    fileName = body.file_name
    contentType = body.content_type
    metadata = body.metadata
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!url || !fileName) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'URL and file_name are required')
  }

  try {
    // URLからファイルを取得
    const response = await fetch(url)
    if (!response.ok) {
      return errorResponse(
        c,
        400,
        ErrorCode.STORAGE_OPERATION_FAILED,
        'Failed to fetch file from URL'
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const detectedContentType =
      contentType || response.headers.get('content-type') || 'application/octet-stream'

    // ファイルをR2にアップロード
    const result = await bucket.put(fileName, arrayBuffer, {
      httpMetadata: {
        contentType: detectedContentType,
      },
      customMetadata: {
        ...metadata,
        sourceUrl: url,
        uploadedAt: new Date().toISOString(),
        uploadMethod: 'url',
      },
    })

    return c.json({
      success: true,
      data: {
        name: fileName,
        size: result.size,
        contentType: detectedContentType,
        lastModified: result.uploaded?.toISOString(),
        etag: result.etag,
        metadata: result.customMetadata || {},
      },
    })
  } catch (error) {
    console.error('Error uploading from URL:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to upload file from URL'
    )
  }
})

// POST /api/storage/presigned-upload - Create presigned upload URL
storage.post('/presigned-upload', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    return c.json(
      {
        success: false,
        error: {
          code: ErrorCode.STORAGE_OPERATION_FAILED,
          message: 'R2 bucket not configured',
        },
      },
      500
    )
  }

  let fileName: string, contentType: string, expiresIn: number | undefined
  try {
    const body = (await c.req.json()) as {
      file_name: string
      content_type: string
      expires_in?: number
    }
    fileName = body.file_name
    contentType = body.content_type
    expiresIn = body.expires_in
  } catch (_error) {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'Invalid JSON in request body')
  }

  if (!fileName || !contentType) {
    return errorResponse(
      c,
      400,
      ErrorCode.VALIDATION_FAILED,
      'file_name and content_type are required'
    )
  }

  try {
    const expirationTime = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : new Date(Date.now() + 3600000)

    // R2では事前署名URLの直接生成機能がないため、通常のアップロードエンドポイントを返す
    const host = c.req.header('host') || c.env.WORKER_DOMAIN || 'localhost:8787'
    const protocol =
      c.req.header('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const baseUrl = `${protocol}://${host}`

    return c.json({
      success: true,
      data: {
        upload_url: `${baseUrl}/api/storage/files`,
        file_url: `${baseUrl}/api/storage/files/${encodeURIComponent(fileName)}/content`,
        expires_at: expirationTime.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating presigned upload:', error)
    return errorResponse(
      c,
      500,
      ErrorCode.STORAGE_OPERATION_FAILED,
      'Failed to create presigned upload'
    )
  }
})

export { storage }
