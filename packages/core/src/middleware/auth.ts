import { Context, Next } from 'hono';
import type { Env, Variables } from '../types';

interface AccessJWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  nbf?: number;
  iss: string;
  type: string;
  identity_nonce?: string;
  sub: string;
  country?: string;
}

// Cloudflare Access JWT検証
export async function verifyAccessJWT(request: Request, env: Env): Promise<AccessJWTPayload | null> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion') || '';
  
  if (!jwt) {
    return null;
  }
  
  try {
    // JWTの構造を解析
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    // ヘッダーをデコードしてkidを取得
    const header = JSON.parse(atob(parts[0]));
    const kid = header.kid;
    
    // Cloudflare Accessの公開鍵を取得
    const certsResponse = await fetch(
      `https://${env.CLOUDFLARE_TEAM_DOMAIN || 'vibebase'}.cloudflareaccess.com/cdn-cgi/access/certs`
    );
    const certs = await certsResponse.json() as { keys: Array<{ kid: string; [key: string]: any }> };
    
    // kidに対応する証明書を見つける
    const cert = certs.keys.find(key => key.kid === kid);
    if (!cert || !cert.kty) {
      return null;
    }
    
    // Web Crypto APIを使用してJWTを検証
    const encoder = new TextEncoder();
    const data = encoder.encode(parts[0] + '.' + parts[1]);
    const signature = new Uint8Array(
      Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), 
      c => c.charCodeAt(0))
    );
    
    // RSA公開鍵をインポート
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      cert as unknown as JsonWebKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // 署名を検証
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      signature,
      data
    );
    
    if (!isValid) {
      return null;
    }
    
    // ペイロードをデコード
    const payload = JSON.parse(atob(parts[1])) as AccessJWTPayload;
    
    // 有効期限をチェック
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now || (payload.nbf && payload.nbf > now)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

export async function requireAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  // Cloudflare Access JWT検証
  const accessPayload = await verifyAccessJWT(c.req.raw, c.env);
  
  if (accessPayload) {
    // GitHubユーザー名を抽出（Cloudflare AccessのGitHub連携時はemail形式になる）
    const githubUsername = extractGitHubUsername(accessPayload);
    
    if (!githubUsername) {
      return c.json({ error: 'Invalid GitHub authentication' }, 401);
    }
    
    // adminsテーブルを確認
    const admin = await c.env.DB?.prepare(
      'SELECT * FROM admins WHERE provider = ? AND provider_id = ?'
    ).bind('github', githubUsername).first();
    
    // 初回アクセス（adminが0人）の場合
    if (!admin) {
      const adminCount = await c.env.DB?.prepare('SELECT COUNT(*) as count FROM admins').first() as { count: number } | null;
      if (adminCount?.count === 0) {
        // 最初のadminとして登録
        const adminId = crypto.randomUUID();
        await c.env.DB?.prepare(
          'INSERT INTO admins (id, email, provider, provider_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(
          adminId,
          accessPayload.email,
          'github',
          githubUsername,
          new Date().toISOString(),
          new Date().toISOString()
        ).run();
        
        c.set('adminId', adminId);
        c.set('user', { 
          id: adminId,
          email: accessPayload.email, 
          provider: 'github',
          providerId: githubUsername,
          isFirstAdmin: true 
        });
        await next();
        return;
      } else {
        // 未登録の場合は拒否
        return c.html(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>アクセス拒否 - Vibebase</title>
              <meta charset="utf-8">
              <style>
                body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; }
                h1 { color: #d73527; }
                .username { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
              </style>
            </head>
            <body>
              <h1>アクセスが拒否されました</h1>
              <p>GitHubユーザー <span class="username">${githubUsername}</span> にはこのVibebaseインスタンスへのアクセス権限がありません。</p>
              <p>管理者に連絡してアクセス権限を付与してもらってください。</p>
            </body>
          </html>
        `, 403);
      }
    }
    
    // 登録済みadminの場合
    c.set('adminId', (admin as any).id);
    c.set('user', {
      id: (admin as any).id,
      email: (admin as any).email,
      provider: (admin as any).provider,
      providerId: (admin as any).provider_id
    });
    await next();
    return;
  }
  
  return c.json({ error: 'Unauthorized' }, 401);
}

function extractGitHubUsername(payload: AccessJWTPayload): string | null {
  // Cloudflare AccessでGitHub認証した場合のemail形式を解析
  // 例: "username@users.noreply.github.com" または通常のメール
  const email = payload.email;
  
  // GitHub noreply形式の場合
  if (email.endsWith('@users.noreply.github.com')) {
    return email.split('@')[0];
  }
  
  // subからGitHubユーザー名を取得（OAuth sub形式による）
  // Cloudflare AccessのGitHub連携では、subにユーザー名が含まれる場合がある
  if (payload.sub && payload.sub.includes('github')) {
    // sub形式の例: "github:username" or "oauth2|github|username"
    const parts = payload.sub.split('|');
    if (parts.length >= 3 && parts[1] === 'github') {
      return parts[2];
    }
    if (payload.sub.startsWith('github:')) {
      return payload.sub.split(':')[1];
    }
  }
  
  // 通常のメール形式の場合、@より前をユーザー名として扱う
  // これは完全ではないが、フォールバック用
  return email.split('@')[0];
}