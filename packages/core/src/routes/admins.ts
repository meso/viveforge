import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

export const admins = new Hono<{ Bindings: Env; Variables: Variables }>();

// Get all admins
admins.get('/', requireAuth, async (c) => {
  const results = await c.env.DB?.prepare('SELECT id, email, provider, provider_id, created_at, updated_at FROM admins ORDER BY created_at ASC').all();
  
  return c.json({
    admins: results?.results || []
  });
});

// Add new admin
admins.post('/', requireAuth, async (c) => {
  const { githubUsername } = await c.req.json();
  
  if (!githubUsername || typeof githubUsername !== 'string') {
    return c.json({ error: 'GitHubユーザー名が必要です' }, 400);
  }
  
  // 既に存在するかチェック
  const existing = await c.env.DB?.prepare(
    'SELECT id FROM admins WHERE provider = ? AND provider_id = ?'
  ).bind('github', githubUsername).first();
  
  if (existing) {
    return c.json({ error: 'そのGitHubユーザーは既に管理者として登録されています' }, 409);
  }
  
  // 新しいadminを追加
  const adminId = crypto.randomUUID();
  const email = `${githubUsername}@users.noreply.github.com`;
  const now = new Date().toISOString();
  
  await c.env.DB?.prepare(
    'INSERT INTO admins (id, email, provider, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(adminId, email, 'github', githubUsername, now, now).run();
  
  // 作成されたadminを返す
  const newAdmin = await c.env.DB?.prepare(
    'SELECT id, email, provider, provider_id, created_at, updated_at FROM admins WHERE id = ?'
  ).bind(adminId).first();
  
  return c.json({ admin: newAdmin }, 201);
});

// Delete admin
admins.delete('/:id', requireAuth, async (c) => {
  const adminId = c.req.param('id');
  
  // 管理者数を確認（最後の1人は削除不可）
  const adminCount = await c.env.DB?.prepare('SELECT COUNT(*) as count FROM admins').first() as { count: number } | null;
  
  if (!adminCount || adminCount.count <= 1) {
    return c.json({ error: '最後の管理者は削除できません' }, 400);
  }
  
  // 削除対象の管理者が存在するかチェック
  const targetAdmin = await c.env.DB?.prepare('SELECT id FROM admins WHERE id = ?').bind(adminId).first();
  
  if (!targetAdmin) {
    return c.json({ error: '指定された管理者が見つかりません' }, 404);
  }
  
  // 自分自身の削除を防ぐ
  const currentAdminId = c.get('adminId');
  if (adminId === currentAdminId) {
    return c.json({ error: '自分自身を削除することはできません' }, 400);
  }
  
  // 削除実行
  await c.env.DB?.prepare('DELETE FROM admins WHERE id = ?').bind(adminId).run();
  
  return c.json({ success: true });
});

// Get current admin info
admins.get('/me', requireAuth, async (c) => {
  const adminId = c.get('adminId');
  
  const admin = await c.env.DB?.prepare(
    'SELECT id, email, provider, provider_id, created_at, updated_at FROM admins WHERE id = ?'
  ).bind(adminId).first();
  
  if (!admin) {
    return c.json({ error: 'Admin not found' }, 404);
  }
  
  return c.json({ admin });
});