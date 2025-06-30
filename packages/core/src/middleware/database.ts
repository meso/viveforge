import type { Context, Next } from 'hono'
import type { Env, Variables } from '../types'
import { serviceUnavailableResponse } from '../utils/responses'

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
