import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { Env, Variables } from '../types'

const storage = new Hono<{ Bindings: Env; Variables: Variables }>()

// ファイル一覧取得
storage.get('/', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const { prefix, limit = 100, cursor } = c.req.query()
  
  try {
    const result = await bucket.list({
      prefix,
      limit: parseInt(limit.toString()),
      cursor
    })

    return c.json({
      objects: result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded,
        contentType: obj.httpMetadata?.contentType,
        customMetadata: obj.customMetadata
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.objects[result.objects.length - 1]?.key : undefined,
      delimitedPrefixes: result.delimitedPrefixes
    })
  } catch (error) {
    console.error('Error listing objects:', error)
    throw new HTTPException(500, { message: 'Failed to list objects' })
  }
})

// ファイルアップロード
storage.post('/upload', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const contentType = c.req.header('content-type')
  if (!contentType || !contentType.includes('multipart/form-data')) {
    throw new HTTPException(400, { message: 'Content-Type must be multipart/form-data' })
  }

  try {
    const formData = await c.req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'No file provided' })
    }
    const path = formData.get('path') as string || ''

    const key = path ? `${path}/${file.name}` : file.name
    const buffer = await file.arrayBuffer()

    const result = await bucket.put(key, buffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream'
      },
      customMetadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    })

    return c.json({
      key: result.key,
      size: result.size,
      uploaded: result.uploaded,
      etag: result.etag
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    if (error instanceof HTTPException) throw error
    throw new HTTPException(500, { message: 'Failed to upload file' })
  }
})

// ファイルダウンロード
storage.get('/download/:key{.*}', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const key = c.req.param('key')
  if (!key) {
    throw new HTTPException(400, { message: 'File key is required' })
  }

  try {
    const object = await bucket.get(key)
    if (!object) {
      throw new HTTPException(404, { message: 'File not found' })
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
    if (error instanceof HTTPException) throw error
    throw new HTTPException(500, { message: 'Failed to download file' })
  }
})

// ファイル情報取得
storage.get('/info/:key{.*}', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const key = c.req.param('key')
  if (!key) {
    throw new HTTPException(400, { message: 'File key is required' })
  }

  try {
    const object = await bucket.head(key)
    if (!object) {
      throw new HTTPException(404, { message: 'File not found' })
    }

    return c.json({
      key: object.key,
      size: object.size,
      uploaded: object.uploaded,
      etag: object.etag,
      httpEtag: object.httpEtag,
      contentType: object.httpMetadata?.contentType,
      customMetadata: object.customMetadata
    })
  } catch (error) {
    console.error('Error getting file info:', error)
    if (error instanceof HTTPException) throw error
    throw new HTTPException(500, { message: 'Failed to get file info' })
  }
})

// ファイル削除
storage.delete('/:key{.*}', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const key = c.req.param('key')
  if (!key) {
    throw new HTTPException(400, { message: 'File key is required' })
  }

  try {
    await bucket.delete(key)
    return c.json({ success: true, message: 'File deleted successfully' })
  } catch (error) {
    console.error('Error deleting file:', error)
    throw new HTTPException(500, { message: 'Failed to delete file' })
  }
})

// 複数ファイル削除
storage.delete('/', async (c) => {
  const bucket = c.env.USER_STORAGE
  if (!bucket) {
    throw new HTTPException(500, { message: 'R2 bucket not configured' })
  }

  const { keys } = await c.req.json() as { keys: string[] }
  if (!keys || !Array.isArray(keys) || keys.length === 0) {
    throw new HTTPException(400, { message: 'Keys array is required' })
  }

  try {
    await bucket.delete(keys)
    return c.json({ 
      success: true, 
      message: `${keys.length} files deleted successfully`,
      deletedKeys: keys
    })
  } catch (error) {
    console.error('Error deleting files:', error)
    throw new HTTPException(500, { message: 'Failed to delete files' })
  }
})

export { storage }