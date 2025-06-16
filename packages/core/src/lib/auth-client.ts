import type { Env } from '../types'

export interface User {
  id: number
  username: string
  email: string
  name: string
  scope: string[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface DeploymentInfo {
  deployment_id: string
  public_key: string
  auth_endpoints: {
    login: string
    callback: string
    refresh: string
    jwks: string
  }
}

export class VibebaseAuthClient {
  private authBaseUrl: string
  private deploymentId: string | null = null
  private deploymentDomain: string
  private publicKeyCache: Map<string, string> = new Map()

  constructor(private env: Env) {
    this.authBaseUrl = env.VIBEBASE_AUTH_URL || 'https://auth.vibebase.workers.dev'
    this.deploymentDomain = env.DEPLOYMENT_DOMAIN || 'unknown'
    this.deploymentId = env.DEPLOYMENT_ID || null
  }

  /**
   * 起動時の初期化 - デプロイメント登録または検証
   */
  async initialize(): Promise<void> {
    try {
      if (!this.deploymentId) {
        // 初回起動時は自動登録
        await this.registerDeployment()
      } else {
        // 既存デプロイメントの検証
        await this.validateDeployment()
      }
    } catch (error) {
      console.error('Auth initialization failed:', error)
      // 失敗した場合は再登録を試行
      if (this.deploymentId) {
        await this.registerDeployment()
      }
    }
  }

  /**
   * デプロイメント登録
   */
  private async registerDeployment(): Promise<void> {
    const response = await fetch(`${this.authBaseUrl}/api/deployments/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deployment-Domain': this.deploymentDomain,
        'X-API-Version': '1.0'
      },
      body: JSON.stringify({
        domain: this.deploymentDomain,
        version: '0.2.0',
        features: ['database', 'storage', 'auth'],
        metadata: {
          worker_name: this.env.WORKER_NAME || 'vibebase',
          created_at: new Date().toISOString()
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Deployment registration failed: ${response.status}`)
    }

    const result = await response.json() as DeploymentInfo
    this.deploymentId = result.deployment_id

    // 公開鍵をキャッシュ
    await this.cachePublicKey(result.public_key)

    console.log(`Deployment registered: ${this.deploymentId}`)
  }

  /**
   * デプロイメント検証
   */
  private async validateDeployment(): Promise<void> {
    if (!this.deploymentId) return

    const response = await fetch(`${this.authBaseUrl}/api/deployments/${this.deploymentId}/validate`, {
      method: 'GET',
      headers: {
        'X-Deployment-ID': this.deploymentId,
        'X-API-Version': '1.0'
      }
    })

    if (!response.ok) {
      console.warn(`Deployment validation failed: ${response.status}`)
      // 再登録を試行
      await this.registerDeployment()
    }
  }

  /**
   * ログインURLを生成
   */
  getLoginUrl(redirectTo: string = '/'): string {
    if (!this.deploymentId) {
      throw new Error('Deployment not initialized')
    }

    const params = new URLSearchParams({
      origin: `https://${this.deploymentDomain}`,
      deployment_id: this.deploymentId,
      redirect_to: redirectTo
    })

    return `${this.authBaseUrl}/auth/login?${params.toString()}`
  }

  /**
   * JWTトークンを検証してユーザー情報を取得
   */
  async verifyToken(token: string): Promise<User> {
    try {
      // 公開鍵取得
      const publicKey = await this.getPublicKey()
      
      // JWT検証（簡易実装 - 本格実装ではライブラリ使用）
      const payload = await this.verifyJWTSignature(token, publicKey)
      
      // ペイロード検証
      this.validateTokenPayload(payload)
      
      return {
        id: payload.github_id,
        username: payload.github_login,
        email: payload.email,
        name: payload.name,
        scope: payload.scope
      }
    } catch (error) {
      const err = error as Error
      throw new Error(`Token verification failed: ${err.message}`)
    }
  }

  /**
   * リクエストから認証情報を取得・検証
   */
  async verifyRequest(c: any): Promise<User | null> {
    try {
      // Authorization ヘッダーからトークン取得
      const authHeader = c.req.header('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        return await this.verifyToken(token)
      }

      // Cookieからトークン取得
      const cookieToken = c.req.raw.headers.get('Cookie')?.match(/access_token=([^;]+)/)?.[1]
      if (cookieToken) {
        return await this.verifyToken(cookieToken)
      }

      return null
    } catch (error) {
      console.error('Request verification failed:', error)
      return null
    }
  }

  /**
   * リフレッシュトークンでアクセストークンを更新
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const response = await fetch(`${this.authBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * トークンを無効化
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await fetch(`${this.authBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refresh_token: token
        })
      })
    } catch (error) {
      // ログアウトは失敗しても無視
      console.warn('Token revocation failed:', error)
    }
  }

  /**
   * 公開鍵を取得（キャッシュ付き）
   */
  private async getPublicKey(): Promise<string> {
    const cacheKey = 'current'
    
    if (this.publicKeyCache.has(cacheKey)) {
      return this.publicKeyCache.get(cacheKey)!
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/.well-known/jwks.json`)
      const jwks = await response.json() as { keys: any[] }
      
      // 最新の公開鍵を取得
      const key = jwks.keys[0]
      const publicKey = await this.jwkToPublicKey(key)
      
      // キャッシュに保存（5分間）
      this.publicKeyCache.set(cacheKey, publicKey)
      setTimeout(() => this.publicKeyCache.delete(cacheKey), 5 * 60 * 1000)
      
      return publicKey
    } catch (error) {
      const err = error as Error
      throw new Error(`Failed to fetch public key: ${err.message}`)
    }
  }

  /**
   * 公開鍵をキャッシュ
   */
  private async cachePublicKey(publicKey: string): Promise<void> {
    this.publicKeyCache.set('current', publicKey)
    setTimeout(() => this.publicKeyCache.delete('current'), 5 * 60 * 1000)
  }

  /**
   * JWK to PEM conversion (簡易実装)
   */
  private async jwkToPublicKey(jwk: any): Promise<string> {
    // 実際の実装では適切なライブラリを使用
    // ここでは簡易的な実装
    return jwk.x5c ? jwk.x5c[0] : jwk.n
  }

  /**
   * JWT署名検証 (簡易実装)
   */
  private async verifyJWTSignature(token: string, publicKey: string): Promise<any> {
    // 実際の実装ではjose等のライブラリを使用
    // ここでは簡易的にペイロードのみ取得
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    const payload = JSON.parse(atob(parts[1]))
    return payload
  }

  /**
   * トークンペイロード検証
   */
  private validateTokenPayload(payload: any): void {
    const now = Math.floor(Date.now() / 1000)

    // 有効期限チェック
    if (payload.exp < now) {
      throw new Error('Token expired')
    }

    // 発行者チェック
    if (payload.iss !== this.authBaseUrl) {
      throw new Error('Invalid issuer')
    }

    // 対象者チェック
    if (payload.aud !== this.deploymentId) {
      throw new Error('Invalid audience')
    }

    // トークンタイプチェック
    if (payload.token_type !== 'access') {
      throw new Error('Invalid token type')
    }

    // 有効開始時刻チェック
    if (payload.nbf && payload.nbf > now) {
      throw new Error('Token not yet valid')
    }
  }

  /**
   * デプロイメントIDを取得
   */
  getDeploymentId(): string | null {
    return this.deploymentId
  }
}