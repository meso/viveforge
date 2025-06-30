import type { Context } from 'hono'
import type { Env, Variables } from '../types'

export function errorResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  message: string,
  status = 500
) {
  // @ts-expect-error - Hono's status type is too restrictive
  return c.json({ error: message }, status)
}

export function successResponse<T>(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  data?: T,
  message?: string
) {
  const response: { success: boolean; message?: string; data?: T } = { success: true }
  if (message) response.message = message
  if (data !== undefined) response.data = data
  return c.json(response)
}

export function validationErrorResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  error: string,
  details?: string[]
) {
  const response: { error: string; details?: string[] } = { error }
  if (details) response.details = details
  return c.json(response, 400)
}

export function notFoundResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  resource: string
) {
  return c.json({ error: `${resource} not found` }, 404)
}

export function serviceUnavailableResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  service: string
) {
  return c.json({ error: `${service} not available` }, 503)
}
