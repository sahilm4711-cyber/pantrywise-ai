// Shared UTC calendar-day helpers — PRD v1.3 §6.1 date rules.
//
// Extracted from the Module 1 engine so the store, seed, and validation all
// share exactly one date implementation. The engine re-exports what it used
// to define locally, so its public API is unchanged.
//
// Two parsers, deliberately different:
// - toDayMs is LENIENT (engine behaviour): it reads the YYYY-MM-DD prefix
//   of any string, so the scorer never throws on messy data.
// - isValidDateKey is STRICT (entry validation): the string must be exactly
//   YYYY-MM-DD and a real calendar date (2026-02-30 is rejected).

export const DAY_MS = 24 * 60 * 60 * 1000

export function toDayMs(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return Number.NaN
    return Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    )
  }
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
    if (!m) return Number.NaN
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return Number.NaN
}

export function isDateLike(value) {
  return !Number.isNaN(toDayMs(value))
}

/** True only for an exactly-YYYY-MM-DD string that is a real calendar date. */
export function isValidDateKey(value) {
  if (typeof value !== 'string') return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const d = new Date(ms)
  return (
    d.getUTCFullYear() === Number(m[1]) &&
    d.getUTCMonth() === Number(m[2]) - 1 &&
    d.getUTCDate() === Number(m[3])
  )
}

export function formatDay(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

export function todayKey() {
  const now = new Date()
  return formatDay(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

/** Calendar days from `from` to `to` (to − from). */
export function daysBetween(from, to) {
  return Math.round((toDayMs(to) - toDayMs(from)) / DAY_MS)
}

export function addDays(dateValue, days) {
  return formatDay(toDayMs(dateValue) + days * DAY_MS)
}
