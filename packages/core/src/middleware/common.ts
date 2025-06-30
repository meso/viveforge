import type { Context, Next } from 'hono'
import type { Env, Variables } from '../types'
import { errorResponse, serviceUnavailableResponse } from '../utils/responses'
import { getCurrentUser } from './auth'

/**
 * Database availability check middleware
 * Ensures that the D1 database is available before processing requests
 */
export async function requireDatabase(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  if (!c.env.DB) {
    return serviceUnavailableResponse(c, 'Database')
  }

  await next()
}

/**
 * Storage availability check middleware
 * Ensures that R2 storage buckets are available before processing requests
 */
export async function requireStorage(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  if (!c.env.USER_STORAGE || !c.env.SYSTEM_STORAGE) {
    return serviceUnavailableResponse(c, 'Storage')
  }

  await next()
}

/**
 * Admin authentication check middleware
 * Ensures that a valid admin user is authenticated
 * Use this after multiAuth middleware
 */
export async function requireAdminUser(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const user = getCurrentUser(c)
  if (!user) {
    return errorResponse(c, 'Authentication required', 401)
  }

  await next()
}
