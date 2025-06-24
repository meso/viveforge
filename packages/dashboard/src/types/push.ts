/**
 * Push notification type definitions
 * Centralized location for all push notification-related interfaces and types
 */

export interface NotificationRule {
  id: string
  name: string
  description?: string
  triggerType: 'db_change' | 'api'
  tableName?: string
  eventType?: 'insert' | 'update' | 'delete'
  recipientType: 'specific_user' | 'column_reference' | 'all_users'
  recipientValue?: string
  titleTemplate: string
  bodyTemplate: string
  iconUrl?: string
  imageUrl?: string
  clickAction?: string
  priority: 'high' | 'normal' | 'low'
  ttl: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface NotificationLog {
  id: string
  ruleId?: string
  userId: string
  provider: string
  title: string
  body: string
  status: 'sent' | 'failed' | 'pending'
  errorMessage?: string
  sentAt?: string
  createdAt: string
}

export interface RuleFormData {
  name: string
  description: string
  triggerType: 'db_change' | 'api'
  tableName: string
  eventType: 'insert' | 'update' | 'delete'
  recipientType: 'specific_user' | 'column_reference' | 'all_users'
  recipientValue: string
  titleTemplate: string
  bodyTemplate: string
  iconUrl: string
  imageUrl: string
  clickAction: string
  priority: 'high' | 'normal' | 'low'
  ttl: number
  enabled: boolean
}

export type ActiveTab = 'settings' | 'test' | 'rules' | 'logs'
