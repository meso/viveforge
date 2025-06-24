import type { Context } from 'hono'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env, Variables } from '../types'
import { ErrorCode } from '../types/errors'

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
storage.get('/', async (c) => {
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

  const { prefix, limit = 100, cursor } = c.req.query()

  try {
    const result = await bucket.list({
      prefix,
      limit: parseInt(limit.toString()),
      cursor,
    })

    return c.json({
      objects: result.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        contentType: obj.httpMetadata?.contentType,
        customMetadata: obj.customMetadata,
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.objects[result.objects.length - 1]?.key : undefined,
      delimitedPrefixes: result.delimitedPrefixes,
    })
  } catch (error) {
    console.error('Error listing objects:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to list objects')
  }
})

// ファイルアップロード
storage.post('/upload', async (c) => {
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
  if (!contentType || !contentType.includes('multipart/form-data')) {
    return errorResponse(
      c,
      400,
      ErrorCode.VALIDATION_FAILED,
      'Content-Type must be multipart/form-data'
    )
  }

  try {
    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'No file provided')
    }
    const path = (formData.get('path') as string) || ''

    const fileObj = file as File
    const key = path ? `${path}/${fileObj.name}` : fileObj.name
    const buffer = await fileObj.arrayBuffer()

    const result = await bucket.put(key, buffer, {
      httpMetadata: {
        contentType: fileObj.type || 'application/octet-stream',
      },
      customMetadata: {
        originalName: fileObj.name,
        uploadedAt: new Date().toISOString(),
      },
    })

    return c.json({
      key: result.key,
      size: result.size,
      uploaded: result.uploaded,
      etag: result.etag,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    if (error instanceof HTTPException) {
      return errorResponse(c, error.status, ErrorCode.STORAGE_OPERATION_FAILED, error.message)
    }
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to upload file')
  }
})

// ファイルダウンロード
storage.get('/download/:key{.*}', async (c) => {
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

  const key = c.req.param('key')
  if (!key || key.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File key is required')
  }

  try {
    const object = await bucket.get(key)
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
storage.get('/info/:key{.*}', async (c) => {
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

  const key = c.req.param('key')
  if (!key || key.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File key is required')
  }

  try {
    const object = await bucket.head(key)
    if (!object) {
      return errorResponse(c, 404, ErrorCode.RECORD_NOT_FOUND, 'File not found')
    }

    return c.json({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      etag: object.etag,
      httpEtag: object.httpEtag,
      contentType: object.httpMetadata?.contentType,
      customMetadata: object.customMetadata,
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
storage.delete('/:key{.*}', async (c) => {
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

  const key = c.req.param('key')
  if (!key || key.trim() === '') {
    return errorResponse(c, 400, ErrorCode.VALIDATION_FAILED, 'File key is required')
  }

  try {
    await bucket.delete(key)
    return c.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting file:', error)
    return errorResponse(c, 500, ErrorCode.STORAGE_OPERATION_FAILED, 'Failed to delete file')
  }
})

// 複数ファイル削除
storage.delete('/', async (c) => {
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

export { storage }
