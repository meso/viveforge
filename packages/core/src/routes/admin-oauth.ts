import { Hono } from 'hono'
import { OAuthManager } from '../lib/oauth-manager'
import { multiAuth, requireAdmin } from '../middleware/auth'
import type { Env, Variables } from '../types'
import {
  errorResponse,
  notFoundResponse,
  serviceUnavailableResponse,
  successResponse,
  validationErrorResponse,
} from '../utils/responses'

const adminOAuth = new Hono<{ Bindings: Env; Variables: Variables }>()

// All admin OAuth routes require admin authentication
adminOAuth.use('*', multiAuth, requireAdmin)

// Get all OAuth providers (admin view with secrets)
adminOAuth.get('/providers', async (c) => {
  try {
    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const result = await c.env.DB.prepare(`
      SELECT id, provider, client_id, client_secret, is_enabled, scopes, redirect_uri, created_at, updated_at
      FROM oauth_providers
      ORDER BY provider
    `).all()

    const providers = result.results.map((p: Record<string, unknown>) => ({
      ...p,
      scopes: p.scopes ? JSON.parse(p.scopes as string) : [],
    }))

    return c.json({ providers })
  } catch (error) {
    console.error('Failed to get OAuth providers:', error)
    return errorResponse(c, 'Failed to get OAuth providers')
  }
})

// Get specific OAuth provider
adminOAuth.get('/providers/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')

    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const result = await c.env.DB.prepare(`
      SELECT id, provider, client_id, client_secret, is_enabled, scopes, redirect_uri, created_at, updated_at
      FROM oauth_providers
      WHERE provider = ?
    `)
      .bind(provider)
      .first()

    if (!result) {
      return notFoundResponse(c, `OAuth provider '${provider}'`)
    }

    const providerData = result as Record<string, unknown>
    return c.json({
      provider: {
        ...providerData,
        scopes: providerData.scopes ? JSON.parse(providerData.scopes as string) : [],
      },
    })
  } catch (error) {
    console.error('Failed to get OAuth provider:', error)
    return errorResponse(c, 'Failed to get OAuth provider')
  }
})

// Create or update OAuth provider
adminOAuth.put('/providers/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')
    const body = await c.req.json()

    // Validate input
    if (!body.client_id || !body.client_secret) {
      return validationErrorResponse(c, 'Validation failed', [
        'client_id and client_secret are required',
      ])
    }

    // Validate provider
    const supportedProviders = [
      'google',
      'github',
      'facebook',
      'linkedin',
      'twitter',
      'apple',
      'microsoft',
      'discord',
      'slack',
    ]
    if (!supportedProviders.includes(provider)) {
      return c.json(
        {
          error: `Unsupported OAuth provider: ${provider}`,
          supported_providers: supportedProviders,
        },
        400
      )
    }

    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const oauthManager = new OAuthManager(c.env.DB)

    // Get default scopes if not provided
    const scopes = body.scopes || oauthManager.getDefaultScopes(provider)

    // Generate default redirect_uri if not provided
    const baseUrl = new URL(c.req.url).origin
    const redirect_uri = body.redirect_uri || `${baseUrl}/api/auth/callback/${provider}`

    await oauthManager.upsertProvider(provider, {
      client_id: body.client_id,
      client_secret: body.client_secret,
      is_enabled: body.is_enabled !== undefined ? body.is_enabled : true,
      scopes: scopes,
      redirect_uri: redirect_uri,
    })

    return successResponse(
      c,
      {
        provider: {
          provider,
          client_id: body.client_id,
          is_enabled: body.is_enabled !== undefined ? body.is_enabled : true,
          scopes: scopes,
          redirect_uri: redirect_uri,
        },
      },
      `OAuth provider '${provider}' configured successfully`
    )
  } catch (error) {
    console.error('Failed to configure OAuth provider:', error)
    return errorResponse(c, 'Failed to configure OAuth provider')
  }
})

// Enable/disable OAuth provider
adminOAuth.patch('/providers/:provider/toggle', async (c) => {
  try {
    const provider = c.req.param('provider')
    const body = await c.req.json()

    if (typeof body.is_enabled !== 'boolean') {
      return validationErrorResponse(c, 'is_enabled must be a boolean')
    }

    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const result = await c.env.DB.prepare(`
      UPDATE oauth_providers 
      SET is_enabled = ?, updated_at = ?
      WHERE provider = ?
    `)
      .bind(body.is_enabled, new Date().toISOString(), provider)
      .run()

    if (result.meta.changes === 0) {
      return notFoundResponse(c, `OAuth provider '${provider}'`)
    }

    return successResponse(
      c,
      undefined,
      `OAuth provider '${provider}' ${body.is_enabled ? 'enabled' : 'disabled'}`
    )
  } catch (error) {
    console.error('Failed to toggle OAuth provider:', error)
    return errorResponse(c, 'Failed to toggle OAuth provider')
  }
})

// Delete OAuth provider
adminOAuth.delete('/providers/:provider', async (c) => {
  try {
    const provider = c.req.param('provider')

    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const result = await c.env.DB.prepare(`
      DELETE FROM oauth_providers WHERE provider = ?
    `)
      .bind(provider)
      .run()

    if (result.meta.changes === 0) {
      return notFoundResponse(c, `OAuth provider '${provider}'`)
    }

    return successResponse(c, undefined, `OAuth provider '${provider}' deleted successfully`)
  } catch (error) {
    console.error('Failed to delete OAuth provider:', error)
    return errorResponse(c, 'Failed to delete OAuth provider')
  }
})

// Get supported OAuth providers with default configurations
adminOAuth.get('/supported-providers', async (c) => {
  try {
    if (!c.env.DB) {
      return serviceUnavailableResponse(c, 'Database')
    }

    const oauthManager = new OAuthManager(c.env.DB)

    const supportedProviders = [
      {
        provider: 'google',
        name: 'Google',
        default_scopes: oauthManager.getDefaultScopes('google'),
        setup_instructions: 'Go to Google Cloud Console → Credentials → Create OAuth 2.0 Client ID',
      },
      {
        provider: 'github',
        name: 'GitHub',
        default_scopes: oauthManager.getDefaultScopes('github'),
        setup_instructions:
          'Go to GitHub Settings → Developer settings → OAuth Apps → New OAuth App',
      },
      {
        provider: 'facebook',
        name: 'Facebook',
        default_scopes: oauthManager.getDefaultScopes('facebook'),
        setup_instructions: 'Go to Facebook Developers → My Apps → Create App → Facebook Login',
      },
      {
        provider: 'linkedin',
        name: 'LinkedIn',
        default_scopes: oauthManager.getDefaultScopes('linkedin'),
        setup_instructions: 'Go to LinkedIn Developers → My Apps → Create App → Auth',
      },
      {
        provider: 'twitter',
        name: 'Twitter/X',
        default_scopes: oauthManager.getDefaultScopes('twitter'),
        setup_instructions: 'Go to Twitter Developer Portal → Projects & Apps → Create App',
      },
      {
        provider: 'microsoft',
        name: 'Microsoft',
        default_scopes: ['openid', 'email', 'profile'],
        setup_instructions: 'Go to Azure Portal → App registrations → New registration',
      },
      {
        provider: 'discord',
        name: 'Discord',
        default_scopes: ['identify', 'email'],
        setup_instructions:
          'Go to Discord Developer Portal → Applications → New Application → OAuth2',
      },
      {
        provider: 'slack',
        name: 'Slack',
        default_scopes: ['identity.basic', 'identity.email'],
        setup_instructions: 'Go to Slack API → Your Apps → Create New App → OAuth & Permissions',
      },
    ]

    return c.json({ supported_providers: supportedProviders })
  } catch (error) {
    console.error('Failed to get supported providers:', error)
    return errorResponse(c, 'Failed to get supported providers')
  }
})

export default adminOAuth
