/**
 * Typed wrappers over /api/v1/reminders — the mobile mirror of
 * apps/web/src/lib/remindersApi.ts. Shapes match remindersRoutes.ts.
 */

import { apiRequest } from '../api/client'

export interface Reminder {
  id: string
  reminder_type: string
  target_entity_id: string | null
  title: string
  body: string | null
  due_at_utc: string
  status: string
  sent_at: string | null
}

export const listReminders = () =>
  apiRequest<{ reminders: Reminder[] }>('/v1/reminders').then((r) => r.reminders)

export const dismissReminder = (id: string) =>
  apiRequest<{ status: string }>(`/v1/reminders/${id}/dismiss`, { method: 'POST' })
