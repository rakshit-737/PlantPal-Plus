/**
 * Streak state transitions — BR-GAM-07, applied at log time.
 *
 * The full specification evaluates one StreakDay outcome per local calendar
 * day (MET / NOT_MET / EXCLUDED / FROZEN / PENDING) in ascending date order.
 * v1.0 applies the same transition table eagerly on each successful log —
 * "today is MET" is known the moment a qualifying log lands, and the days
 * between the last met date and today are the NOT_MET gap the freeze-token
 * rule (one token spares exactly one missed day) may bridge.
 *
 * Pure and clock-free: callers pass local date strings (YYYY-MM-DD, the
 * user's wall clock per FR-SYS-22) and the previous state; the function
 * returns the next state. One place, three clients (NFR-MAIN-03).
 */

export interface StreakState {
  /** Consecutive met days ending at lastCountedDate. */
  currentLength: number
  longestLength: number
  /** Last local date that counted toward the streak (YYYY-MM-DD), null if none. */
  lastCountedDate: string | null
  /** BR-GAM-07 FROZEN row: each token spares exactly one missed day. 0–3. */
  freezeTokens: number
}

export const EMPTY_STREAK: StreakState = {
  currentLength: 0,
  longestLength: 0,
  lastCountedDate: null,
  freezeTokens: 0,
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Whole-day difference b − a between two YYYY-MM-DD local dates. */
export function localDateDiffDays(a: string, b: string): number {
  if (!DATE_RE.test(a) || !DATE_RE.test(b)) {
    throw new RangeError('local dates must be YYYY-MM-DD')
  }
  // Parsed as UTC midnights, so the difference is exact whole days with no
  // DST arithmetic — local-date strings already encode the user's wall clock.
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/**
 * Advance a streak for a log that makes `todayLocalDate` a MET day.
 *
 * Transition rules (BR-GAM-07):
 * - already counted today → no-op (exactly once per date)
 * - a log for a date before the last counted date is ignored — retroactive
 *   recomputation is out of scope for the eager path (FR-GAM recompute owns it)
 * - first ever MET day → current = 1
 * - consecutive day → current + 1
 * - gap of N ≥ 1 missed days: if N freeze tokens are available they are all
 *   consumed and the streak continues (each token spares exactly one day);
 *   otherwise the streak resets and today starts a new one at 1
 * - longest = max(longest, current) after every MET (BR-GAM-08)
 */
export function advanceStreakOnLog(state: StreakState, todayLocalDate: string): StreakState {
  if (!DATE_RE.test(todayLocalDate)) {
    throw new RangeError('todayLocalDate must be YYYY-MM-DD')
  }

  if (state.lastCountedDate === null) {
    return {
      ...state,
      currentLength: 1,
      longestLength: Math.max(state.longestLength, 1),
      lastCountedDate: todayLocalDate,
    }
  }

  const diff = localDateDiffDays(state.lastCountedDate, todayLocalDate)

  // Same day, or a stale/backdated log: no transition.
  if (diff <= 0) return state

  if (diff === 1) {
    const current = state.currentLength + 1
    return {
      ...state,
      currentLength: current,
      longestLength: Math.max(state.longestLength, current),
      lastCountedDate: todayLocalDate,
    }
  }

  const missedDays = diff - 1
  if (missedDays <= state.freezeTokens) {
    const current = state.currentLength + 1
    return {
      currentLength: current,
      longestLength: Math.max(state.longestLength, current),
      lastCountedDate: todayLocalDate,
      freezeTokens: state.freezeTokens - missedDays,
    }
  }

  // NOT_MET with no applicable token: current resets; today starts anew at 1.
  return {
    ...state,
    currentLength: 1,
    longestLength: Math.max(state.longestLength, 1),
    lastCountedDate: todayLocalDate,
  }
}
