/**
 * Custom SQL type definitions
 * Centralized location for all custom SQL-related interfaces and types
 */

import type { BaseResource } from './common'

export interface Parameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  required: boolean
  description?: string
  default?: string | number | boolean
}

export interface CustomQuery extends BaseResource {
  slug: string
  name: string
  description?: string
  sql_query: string
  parameters: Parameter[]
  method: 'GET' | 'POST'
  is_readonly: boolean
  cache_ttl: number
  is_enabled: boolean
}

export interface QueryFormData {
  slug: string
  name: string
  description: string
  sql_query: string
  parameters: Parameter[]
  cache_ttl: number
  is_enabled: boolean
}

export interface TestResult {
  data: unknown[]
  row_count: number
  execution_time: number
}

// Use the shared ValidationErrors type from common
export type { ValidationErrors } from './common'
