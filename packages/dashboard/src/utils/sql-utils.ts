/**
 * SQL utility functions
 * Handles SQL parsing, parameter extraction, and validation
 */

import type { Parameter, QueryFormData, ValidationErrors } from '../types/custom-sql'

// Auto-generate slug from name (proven algorithm)
export const generateSlugFromName = (name: string): string => {
  if (!name.trim()) {
    return Date.now().toString(36).slice(-8).padStart(8, '0')
  }

  // Create a seed based on the string content and length
  let seed = name.length + 1000 // Add offset to avoid small numbers

  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    seed = seed * 31 + char // Classic polynomial rolling hash
    seed = seed & 0x7fffffff // Keep positive
  }

  // Generate 8 characters using a simple PRNG approach
  let result = ''
  let rng = seed

  for (let i = 0; i < 8; i++) {
    // Linear congruential generator
    rng = (rng * 1664525 + 1013904223) & 0x7fffffff
    const digit = rng % 36
    result += digit.toString(36)
  }

  return result
}

// Extract parameters from SQL query
export const extractParametersFromSQL = (sql: string): Parameter[] => {
  const paramRegex = /:(\w+)/g
  const matches = new Set<string>()
  let match: RegExpExecArray | null

  match = paramRegex.exec(sql)
  while (match !== null) {
    matches.add(match[1])
    match = paramRegex.exec(sql)
  }

  return Array.from(matches).map((paramName) => ({
    name: paramName,
    type: 'string' as const,
    required: true,
    description: '',
  }))
}

// Determine HTTP method and readonly status based on SQL
export const determineMethodAndReadonly = (sql: string) => {
  const trimmedSql = sql.trim().toLowerCase()
  const isSelect = trimmedSql.startsWith('select')
  const isPragma = trimmedSql.includes('pragma')

  return {
    method: isSelect ? 'GET' : 'POST',
    readonly: isSelect || isPragma,
  }
}

// Validate form data
export const validateForm = (formData: QueryFormData): ValidationErrors => {
  const errors: ValidationErrors = {}

  // Required field validation
  if (!formData.name.trim()) {
    errors.name = 'クエリ名は必須です'
  }

  if (!formData.slug.trim()) {
    errors.slug = 'スラッグは必須です'
  } else if (!/^[a-z0-9_-]+$/.test(formData.slug)) {
    errors.slug = 'スラッグは小文字の英数字、ハイフン、アンダースコアのみ使用できます'
  }

  if (!formData.sql_query.trim()) {
    errors.sql_query = 'SQLクエリは必須です'
  } else {
    // Check if SQL contains parameters that are not defined
    const paramRegex = /:(\w+)/g
    const sqlParams = new Set<string>()
    let match: RegExpExecArray | null

    match = paramRegex.exec(formData.sql_query)
    while (match !== null) {
      sqlParams.add(match[1])
      match = paramRegex.exec(formData.sql_query)
    }

    const definedParams = new Set((formData.parameters || []).map((p) => p.name))
    const undefinedParams = Array.from(sqlParams).filter((p) => !definedParams.has(p))

    if (undefinedParams.length > 0) {
      errors.sql_query = `SQLに未定義のパラメーターが含まれています: ${undefinedParams.join(', ')}`
    }
  }
  // Parameter validation
  ;(formData.parameters || []).forEach((param, index) => {
    if (!param.name.trim()) {
      errors[`parameter_${index}_name`] = 'パラメーター名は必須です'
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(param.name)) {
      errors[`parameter_${index}_name`] =
        'パラメーター名は英文字またはアンダースコアで始まり、英数字とアンダースコアのみ使用できます'
    }
  })

  return errors
}
