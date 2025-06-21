import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { AppSettingsManager } from '../lib/app-settings-manager'
import { OAuthManager } from '../lib/oauth-manager'
import { UserAuthManager } from '../lib/user-auth-manager'
import { getAuthContext, getCurrentEndUser, multiAuth, requireUserAuth } from '../middleware/auth'
import type { Env, Variables } from '../types'

const userAuth = new Hono<{ Bindings: Env; Variables: Variables }>()

// Get available OAuth providers
userAuth.get('/providers', async (c) => {
  try {
    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }

    const oauthManager = new OAuthManager(c.env.DB)
    const providers = await oauthManager.getEnabledProviders()

    // Return only public information
    const publicProviders = providers.map((p) => ({
      provider: p.provider,
      scopes: p.scopes ? JSON.parse(p.scopes) : [],
    }))

    return c.json({ providers: publicProviders })
  } catch (error) {
    console.error('Failed to get OAuth providers:', error)
    return c.json({ error: 'Failed to get OAuth providers' }, 500)
  }
})

// Initiate OAuth login
userAuth.get('/login/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')
    const returnUrl = c.req.query('return_url') || '/'
    const callbackUrl = c.req.query('callback_url')

    if (!c.env.DB) {
      return c.json({ error: 'Database not available' }, 503)
    }

    // Validate callback URL if provided
    if (callbackUrl) {
      const appSettingsManager = new AppSettingsManager(c.env.DB)

      if (!appSettingsManager.isValidCallbackUrlFormat(callbackUrl)) {
        return c.json({ error: 'Invalid callback URL format' }, 400)
      }

      const isAllowed = await appSettingsManager.isCallbackUrlAllowed(callbackUrl)
      if (!isAllowed) {
        return c.json({ error: 'Callback URL not allowed' }, 403)
      }
    }

    const oauthManager = new OAuthManager(c.env.DB)
    const config = await oauthManager.getProviderConfig(provider)

    if (!config) {
      return c.json({ error: `OAuth provider '${provider}' not configured or disabled` }, 404)
    }

    // Generate state for CSRF protection
    const state = oauthManager.generateState()
    const baseUrl = `${c.req.url.split('/api')[0]}`

    // Store state, return URL, and callback URL in secure cookie
    const authState = {
      state,
      provider,
      return_url: returnUrl,
      callback_url: callbackUrl,
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    }

    setCookie(c, 'oauth_state', JSON.stringify(authState), {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 600, // 10 minutes
    })

    // Generate authorization URL
    const authUrl = oauthManager.generateAuthUrl(provider, config, state, baseUrl)

    return c.json({
      auth_url: authUrl,
      state: state,
    })
  } catch (error) {
    console.error('OAuth login initiation failed:', error)
    return c.json({ error: 'Failed to initiate OAuth login' }, 500)
  }
})

// OAuth callback
userAuth.get('/callback/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')
    const code = c.req.query('code')
    const state = c.req.query('state')
    const error = c.req.query('error')

    // Check for OAuth errors
    if (error) {
      return c.json({ error: `OAuth error: ${error}` }, 400)
    }

    if (!code || !state) {
      return c.json({ error: 'Missing authorization code or state' }, 400)
    }

    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ error: 'Server configuration error' }, 503)
    }

    // Verify state to prevent CSRF attacks
    const storedAuthState = getCookie(c, 'oauth_state')
    if (!storedAuthState) {
      return c.json({ error: 'Invalid or expired OAuth state' }, 400)
    }

    let authState
    try {
      authState = JSON.parse(storedAuthState)
    } catch {
      return c.json({ error: 'Invalid OAuth state format' }, 400)
    }

    if (authState.state !== state || authState.provider !== provider) {
      return c.json({ error: 'OAuth state mismatch' }, 400)
    }

    if (Date.now() > authState.expires) {
      return c.json({ error: 'OAuth state expired' }, 400)
    }

    // Clear OAuth state cookie
    deleteCookie(c, 'oauth_state')

    const oauthManager = new OAuthManager(c.env.DB)
    const config = await oauthManager.getProviderConfig(provider)

    if (!config) {
      return c.json({ error: `OAuth provider '${provider}' not configured` }, 404)
    }

    // Exchange code for access token
    const baseUrl = `${c.req.url.split('/api')[0]}`
    const tokenResponse = await oauthManager.exchangeCodeForToken(provider, code, config, baseUrl)

    // Get user info from OAuth provider
    const oauthUserInfo = await oauthManager.getUserInfo(provider, tokenResponse.access_token)

    // Create or update user in database
    const userAuthManager = new UserAuthManager(
      c.env.DB,
      c.env.JWT_SECRET,
      c.env.DOMAIN || 'localhost'
    )
    const user = await userAuthManager.createOrUpdateUser({
      provider,
      provider_id: oauthUserInfo.id,
      email: oauthUserInfo.email,
      name: oauthUserInfo.name,
      avatar_url: oauthUserInfo.avatar_url,
      metadata: oauthUserInfo,
    })

    // Generate JWT tokens
    const tokens = await userAuthManager.generateTokens(user)

    // Check if we should redirect to a callback URL
    let finalReturnUrl = authState.return_url

    if (authState.callback_url) {
      // Callback URL was already validated during login initiation
      finalReturnUrl = authState.callback_url
    }

    // Return tokens and user info
    return c.json({
      success: true,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
      return_url: finalReturnUrl,
    })
  } catch (error) {
    console.error('OAuth callback failed:', error)
    return c.json({ error: 'OAuth authentication failed' }, 500)
  }
})

// Refresh access token
userAuth.post('/refresh', async (c) => {
  try {
    const body = await c.req.json()
    const refreshToken = body.refresh_token

    if (!refreshToken) {
      return c.json({ error: 'Refresh token required' }, 400)
    }

    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ error: 'Server configuration error' }, 503)
    }

    const userAuthManager = new UserAuthManager(
      c.env.DB,
      c.env.JWT_SECRET,
      c.env.DOMAIN || 'localhost'
    )
    const result = await userAuthManager.refreshAccessToken(refreshToken)

    if (!result) {
      return c.json({ error: 'Invalid or expired refresh token' }, 401)
    }

    return c.json({
      access_token: result.accessToken,
    })
  } catch (error) {
    console.error('Token refresh failed:', error)
    return c.json({ error: 'Token refresh failed' }, 500)
  }
})

// Get current user info
userAuth.get('/me', multiAuth, requireUserAuth(), async (c) => {
  const user = getCurrentEndUser(c)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
      provider: user.provider,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    },
  })
})

// Logout user
userAuth.post('/logout', multiAuth, requireUserAuth(), async (c) => {
  try {
    const authContext = getAuthContext(c)

    if (!authContext || authContext.type !== 'user') {
      return c.json({ error: 'Invalid authentication context' }, 400)
    }

    if (!c.env.DB || !c.env.JWT_SECRET) {
      return c.json({ error: 'Server configuration error' }, 503)
    }

    const userAuthManager = new UserAuthManager(
      c.env.DB,
      c.env.JWT_SECRET,
      c.env.DOMAIN || 'localhost'
    )
    await userAuthManager.logout(authContext.session.id)

    return c.json({ success: true, message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout failed:', error)
    return c.json({ error: 'Logout failed' }, 500)
  }
})

export default userAuth
