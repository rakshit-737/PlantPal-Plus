/**
 * The offline outbox, in one import.
 *
 * Screens need exactly two things from here: a write-through logger for the
 * action they perform, and QUEUED_MESSAGE / describeWriteError to say what
 * happened. Everything else is wiring.
 */

export { OutboxIndicator } from './OutboxIndicator'
export { OutboxProvider } from './OutboxProvider'
export {
  clearOutbox,
  dismissOutboxNotice,
  drainOutbox,
  getOutboxSnapshot,
  hydrateOutbox,
  isOfflineError,
  setOutboxOwner,
} from './outbox'
export type { OutboxEntityType, OutboxItem, OutboxSnapshot } from './types'
export { storageKind } from './storage'
export { useOutbox, usePendingSyncCount } from './useOutbox'
export {
  QUEUED_MESSAGE,
  describeWriteError,
  logCareWriteThrough,
  logMealWriteThrough,
  logWaterWriteThrough,
  logWorkoutWriteThrough,
} from './writeThrough'
export type { CareInput, MealInput, MealItemInput, WorkoutInput, WriteResult } from './writeThrough'
