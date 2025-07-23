import type { Env } from '../types'

export interface User {
  id: string
  email: string
  name?: string
  avatar_url?: string
  provider: string
  provider_id: string
  role: string
  metadata?: string
  last_login_at?: string
  is_active: boolean
  created_at: string
  updated_at: string
  username?: string // For compatibility with existing code
  scope?: string[] // For compatibility with existing code
  [key: string]: unknown // Allow additional properties
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface JWKKey {
  kty: string
  use?: string
  key_ops?: string[]
  alg?: string
  kid?: string
  x5c?: string[]
  n?: string // RSA public key modulus
  e?: string // RSA public key exponent
  x?: string // EC public key x coordinate
  y?: string // EC public key y coordinate
  crv?: string // EC curve
}

export interface JWKSet {
  keys: JWKKey[]
}

export interface JWTPayload {
  iss?: string // issuer
  aud?: string // audience
  exp?: number // expiration time
  nbf?: number // not before
  iat?: number // issued at
  jti?: string // JWT ID
  token_type?: string
  github_id?: number
  github_login?: string
  email?: string
  name?: string
  scope?: string[]
  [key: string]: unknown // Allow additional properties
}

// Hono context type (simplified interface for what we need)
export interface HonoContext {
  req: {
    header: (name: string) => string | undefined
    raw: {
      headers: {
        get: (name: string) => string | null
      }
    }
  }
  res: {
    headers: {
      append: (name: string, value: string) => void
    }
  }
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
  private originalWorkerDomain: string
  private publicKeyCache: Map<string, string> = new Map()

  constructor(private env: Env) {
    this.authBaseUrl = env.VIBEBASE_AUTH_URL || 'https://auth.vibebase.workers.dev'

    // 元のWORKER_DOMAINを保存（URL生成用）
    this.originalWorkerDomain = env.WORKER_DOMAIN || 'unknown'

    // WORKER_DOMAINからポート番号を除去してaudienceとして使用
    let domain = this.originalWorkerDomain
    if (domain.includes(':')) {
      domain = domain.split(':')[0]
    }
    this.deploymentDomain = domain

    // deployment_idは不要になったため削除
    this.deploymentId = null
  }

  /**
   * Worker名をドメインから推測
   */
  private getWorkerName(): string {
    const domain = this.deploymentDomain
    if (domain.includes('.workers.dev')) {
      // xxx.yyy.workers.dev から xxx を抽出
      return domain.split('.')[0]
    }
    if (domain.includes('localhost')) {
      return 'vibebase-dev'
    }
    return 'vibebase'
  }

  /**
   * 起動時の初期化
   */
  async initialize(): Promise<void> {
    // deployment管理はvibebase-auth側で行うため、特に初期化処理は不要
  }

  /**
   * デプロイメント登録
   */
  private async registerDeployment(): Promise<void> {
    console.log(`Registering deployment with auth server: ${this.authBaseUrl}`)
    console.log(`Deployment domain: ${this.deploymentDomain}`)

    try {
      const response = await fetch(`${this.authBaseUrl}/api/deployments/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Deployment-Domain': this.deploymentDomain,
          'X-API-Version': '1.0',
        },
        body: JSON.stringify({
          domain: this.deploymentDomain,
          version: '0.2.0',
          features: ['database', 'storage', 'auth'],
          metadata: {
            worker_name: this.getWorkerName(),
            created_at: new Date().toISOString(),
          },
        }),
      })

      console.log(`Registration response status: ${response.status}`)

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error(`Registration failed with response:`, errorResponse)

        // ドメインが既に登録済みの場合は、既存のデプロイメント情報を取得
        if (
          response.status === 409 ||
          (errorResponse &&
            typeof errorResponse === 'object' &&
            'error' in errorResponse &&
            typeof errorResponse.error === 'string' &&
            errorResponse.error.includes('already registered'))
        ) {
          console.log('Domain already registered, attempting to get existing deployment...')
          return await this.getExistingDeployment()
        }

        throw new Error(
          `Deployment registration failed: ${response.status} - ${errorResponse && typeof errorResponse === 'object' && 'error' in errorResponse ? errorResponse.error : 'Unknown error'}`
        )
      }

      const result = (await response.json()) as DeploymentInfo
      this.deploymentId = result.deployment_id

      // 公開鍵をキャッシュ
      await this.cachePublicKey(result.public_key)

      console.log(`Deployment registered successfully: ${this.deploymentId}`)
    } catch (error) {
      console.error('Deployment registration error:', error)
      throw error
    }
  }

  /**
   * 既存のデプロイメント情報を取得
   */
  private async getExistingDeployment(): Promise<void> {
    try {
      const response = await fetch(
        `${this.authBaseUrl}/api/deployments/by-domain/${encodeURIComponent(this.deploymentDomain)}`,
        {
          method: 'GET',
          headers: {
            'X-API-Version': '1.0',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to get existing deployment: ${response.status}`)
      }

      const result = (await response.json()) as DeploymentInfo
      this.deploymentId = result.deployment_id

      // 公開鍵をキャッシュ
      await this.cachePublicKey(result.public_key)

      console.log(`Retrieved existing deployment: ${this.deploymentId}`)
    } catch (error) {
      console.error('Failed to get existing deployment:', error)
      throw error
    }
  }

  /**
   * デプロイメント検証
   */
  private async validateDeployment(): Promise<void> {
    if (!this.deploymentId) return

    const response = await fetch(
      `${this.authBaseUrl}/api/deployments/${this.deploymentId}/validate`,
      {
        method: 'GET',
        headers: {
          'X-Deployment-ID': this.deploymentId,
          'X-API-Version': '1.0',
        },
      }
    )

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
    // 開発環境ではhttpを使用
    const protocol = this.originalWorkerDomain.includes('localhost') ? 'http' : 'https'
    const params = new URLSearchParams({
      origin: `${protocol}://${this.originalWorkerDomain}`, // ポート番号込みを使用
      redirect_to: redirectTo,
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

      // JWT検証（hono/jwtを使用）
      const payload = await this.verifyJWTWithHono(token, publicKey)

      // ペイロード検証
      this.validateTokenPayload(payload)

      return {
        id: String(payload.github_id || ''),
        email: payload.email || '',
        name: payload.name,
        provider: 'github',
        provider_id: String(payload.github_id || ''),
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        username: payload.github_login,
        scope: payload.scope,
      }
    } catch (error) {
      const err = error as Error
      throw new Error(`Token verification failed: ${err.message}`)
    }
  }

  /**
   * JWT token verification (public method for API key auth)
   */
  async verifyJWT(token: string): Promise<User | null> {
    try {
      return await this.verifyToken(token)
    } catch (error) {
      console.error('JWT verification failed:', error)
      return null
    }
  }

  /**
   * リクエストから認証情報を取得・検証
   */
  async verifyRequest(c: HonoContext): Promise<User | null> {
    try {
      // Authorization ヘッダーからトークン取得
      const authHeader = c.req.header('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        console.log('Found Authorization header')
        const token = authHeader.substring(7)
        return await this.verifyToken(token)
      }

      // Cookieからトークン取得
      const cookieHeader = c.req.raw.headers.get('Cookie')
      const cookieToken = cookieHeader?.match(/access_token=([^;]+)/)?.[1]
      const refreshToken = cookieHeader?.match(/refresh_token=([^;]+)/)?.[1]

      if (cookieToken) {
        try {
          return await this.verifyToken(cookieToken)
        } catch (_error) {
          // アクセストークンが無効な場合、リフレッシュトークンで更新を試行
        }
      }

      // access_tokenがないまたは無効で、refresh_tokenがある場合、リフレッシュを試行
      if (refreshToken) {
        try {
          const tokens = await this.refreshToken(refreshToken)

          // 新しいCookieを設定
          const expires = tokens.expires_in
          const refreshExpires = 30 * 24 * 60 * 60 // 30日

          // 開発環境ではSecureフラグを無効にする
          const host = c.req.header('host')
          const isLocalhost = host?.includes('localhost') || false
          const secureFlag = isLocalhost ? '' : ' Secure;'

          c.res.headers.append(
            'Set-Cookie',
            `access_token=${tokens.access_token}; HttpOnly;${secureFlag} SameSite=Strict; Max-Age=${expires}; Path=/`
          )
          c.res.headers.append(
            'Set-Cookie',
            `refresh_token=${tokens.refresh_token}; HttpOnly;${secureFlag} SameSite=Strict; Max-Age=${refreshExpires}; Path=/`
          )

          return await this.verifyToken(tokens.access_token)
        } catch (_error) {
          // リフレッシュ失敗時はクッキーをクリア
          const host = c.req.header('host')
          const isLocalhost = host?.includes('localhost') || false
          const secureFlag = isLocalhost ? '' : ' Secure;'
          c.res.headers.append(
            'Set-Cookie',
            `access_token=; HttpOnly;${secureFlag} Max-Age=0; Path=/`
          )
          c.res.headers.append(
            'Set-Cookie',
            `refresh_token=; HttpOnly;${secureFlag} Max-Age=0; Path=/`
          )
          return null
        }
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`)
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: token,
        }),
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
      const cachedKey = this.publicKeyCache.get(cacheKey)
      if (cachedKey) {
        return cachedKey
      }
    }

    try {
      const response = await fetch(`${this.authBaseUrl}/.well-known/jwks.json`)
      const jwks = (await response.json()) as JWKSet

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
   * JWK to PEM conversion
   */
  private async jwkToPublicKey(jwk: JWKKey): Promise<string> {
    // x5c (X.509 Certificate Chain) が利用可能な場合
    if (jwk.x5c?.[0]) {
      const cert = jwk.x5c[0]
      // Base64エンコードされた証明書をPEM形式に変換
      const pemCert = `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)?.join('\n')}\n-----END CERTIFICATE-----`
      return pemCert
    }

    // RSA公開鍵の場合はJWK形式をそのまま返す（hono/jwtがJWKをサポート）
    if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
      return JSON.stringify(jwk)
    }

    throw new Error('Unsupported JWK format')
  }

  /**
   * JWT署名検証 (hono/jwt使用)
   */
  private async verifyJWTWithHono(token: string, publicKeyData: string): Promise<JWTPayload> {
    try {
      // E2E/開発環境でのテスト用JWT検証
      if (this.env.ENVIRONMENT === 'development' && this.env.JWT_SECRET) {
        console.log('Using test JWT verification for E2E environment')
        const { verify } = await import('hono/jwt')
        const payload = await verify(token, this.env.JWT_SECRET, 'HS256')
        return payload
      }

      // hono/jwtのverify関数を直接使用
      const { verify } = await import('hono/jwt')

      // 公開鍵のフォーマットを判定
      let publicKey: string | JWKKey = publicKeyData

      // JSON文字列の場合はパース（JWK形式）
      try {
        const parsed = JSON.parse(publicKeyData)
        if (parsed.kty) {
          publicKey = parsed
        }
      } catch {
        // JSON パースに失敗した場合は文字列（PEM形式）のまま使用
        publicKey = publicKeyData
      }

      // RS256で検証
      const payload = await verify(token, publicKey, 'RS256')
      return payload
    } catch (error) {
      const err = error as Error
      throw new Error(`JWT verification failed: ${err.message}`)
    }
  }

  /**
   * トークンペイロード検証
   */
  private validateTokenPayload(payload: JWTPayload): void {
    const now = Math.floor(Date.now() / 1000)

    // 重要: audフィールドが自分のドメインと一致するかチェック
    if (!payload.aud || payload.aud !== this.deploymentDomain) {
      throw new Error(`Invalid audience: expected ${this.deploymentDomain}, got ${payload.aud}`)
    }

    // 発行者チェック - 信頼できるvibebase-authからのトークンか
    // E2E/開発環境ではテスト用issuerも許可
    const validIssuers = [this.authBaseUrl]
    if (this.env.ENVIRONMENT === 'development') {
      validIssuers.push('https://auth.vibebase.workers.dev')
    }

    if (!payload.iss || !validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid issuer: ${payload.iss}`)
    }

    // 有効期限チェック
    if (!payload.exp || payload.exp < now) {
      throw new Error('Token expired')
    }

    // トークンタイプチェック
    if (!payload.token_type || payload.token_type !== 'access') {
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
