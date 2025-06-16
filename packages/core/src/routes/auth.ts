import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Env, Variables, Session } from '../types'
import { requireAuth } from '../middleware/auth'

export const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

// Session management utilities
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

async function createSession(adminId: string, kv: KVNamespace | undefined): Promise<Session | null> {
  if (!kv) return null
  const session: Session = {
    id: crypto.randomUUID(),
    adminId,
    expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString(),
  }
  
  await kv.put(`session:${session.id}`, JSON.stringify(session), {
    expirationTtl: SESSION_DURATION / 1000,
  })
  
  return session
}

async function getSession(sessionId: string, kv: KVNamespace | undefined): Promise<Session | null> {
  if (!kv) return null
  const data = await kv.get(`session:${sessionId}`)
  if (!data) return null
  
  const session = JSON.parse(data) as Session
  if (new Date(session.expiresAt) < new Date()) {
    await kv.delete(`session:${sessionId}`)
    return null
  }
  
  return session
}

// Legacy session-based auth (kept for compatibility)
async function requireSessionAuth(c: any, next: () => Promise<void>) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const session = await getSession(sessionId, c.env.SESSIONS)
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  c.set('adminId', session.adminId)
  await next()
}

// Auth endpoints
auth.get('/me', requireAuth, async (c) => {
  const adminId = c.get('adminId')
  
  const admin = await c.env.DB?.prepare(
    'SELECT id, email, provider, provider_id, created_at, updated_at FROM admins WHERE id = ?'
  ).bind(adminId).first()
  
  if (!admin) {
    return c.json({ error: 'Admin not found' }, 404)
  }
  
  return c.json({ admin })
})

auth.post('/logout', requireAuth, async (c) => {
  const sessionId = getCookie(c, 'session')
  if (sessionId && c.env.SESSIONS) {
    await c.env.SESSIONS.delete(`session:${sessionId}`)
    setCookie(c, 'session', '', { maxAge: 0 })
  }
  
  return c.json({ success: true })
})

// OAuth callback placeholder
auth.get('/callback/:provider', async (c) => {
  const provider = c.req.param('provider')
  
  // TODO: Implement OAuth callback handling
  return c.json({ 
    message: `OAuth callback for ${provider}`, 
    note: 'To be implemented with @hono/oauth-providers' 
  })
})