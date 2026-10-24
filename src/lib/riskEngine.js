// Pure-JavaScript waste-risk engine — PRD v1.3 §6.1, §6.3, FR-02, FR-08, FR-09.
// No React, no I/O, no dates from the environment unless the caller omits
// currentDate. Deterministic: identical inputs always produce identical output.
//
// Item shape (subset of the PRD GroceryItem, §7):
//   { id, category, quantityRemaining, purchaseDate?, expiryDate?,
//     averageDailyUse?, events? }
// Dates accept 'YYYY-MM-DD' strings (or ISO datetimes, date part used) or
// Date objects. All day math is done in UTC calendar days, so timezones and
// DST cannot shift a result by a day.
// Events (subset of InventoryEvent, §7):
//   { itemId, category, eventType, quantity, timestamp }
//
// Spec notes and module-level interpretations (flagged, not hidden):
// - The PRD defines no numeric daily-use rates per category, so the
//   "category prior" step only applies when the caller configures rates via
//   options.categoryDailyUsePriors. Otherwise an item with no user value and
//   no learned value is insufficient-data, exactly as §6.3 step 4 states.
// - Learning counts CONSUMED events only: §6.3 defines the rate as "total
//   consumed quantity". Discarded and adjusted events are ignored for the
//   rate (they still drive lifecycle state in Module 2).
// - "Days observed" is the calendar-day difference between the earliest and
//   latest consumed event, minimum 1 (§6.3 wording), not an inclusive count.
// - Malformed dates are treated as missing (entry validation in Module 2
//   rejects them); the scorer never throws on data, so one bad item cannot
//   break a 200-item recompute.
// - Confidence labels are FR-10 (P1), implemented early because they are a
//   pure function of provenance the scorer already resolves.

import {
  DAY_MS,
  addDays,
  daysBetween,
  formatDay,
  isDateLike,
  toDayMs,
  todayKey,
} from './dates.js'
import { getShelfLifePrior } from './priors.js'

// Date helpers moved to dates.js in Module 2; daysBetween is re-exported so
// the engine's public API (and Module 1's tests) keep working unchanged.
export { daysBetween }

export const URGENCY_WEIGHT = 0.6
export const EXCESS_WEIGHT = 0.4
export const HIGH_THRESHOLD = 70
export const MEDIUM_THRESHOLD = 40
export const MIN_LEARNING_EVENTS = 3

/** Urgency score U from the §6.1 piecewise table. */
export function urgencyFor(daysLeft) {
  if (daysLeft <= 0) return 100
  if (daysLeft === 1) return 90
  if (daysLeft === 2) return 75
  if (daysLeft === 3) return 60
  if (daysLeft <= 5) return 40
  if (daysLeft <= 7) return 25
  return Math.max(0, 25 - 2 * (daysLeft - 7))
}

export function bandFor(riskScore) {
  if (riskScore >= HIGH_THRESHOLD) return 'High'
  if (riskScore >= MEDIUM_THRESHOLD) return 'Medium'
  return 'Low'
}

/**
 * Resolve an item's expiry: its own date (Known), or purchaseDate + the
 * category prior (Estimated (prior), FR-08), or null when neither yields a
 * date. "Insufficient data" applies only when neither date exists (FR-08);
 * an unknown category with a purchase date also yields null, because no
 * prior exists for it.
 */
export function resolveExpiry(item) {
  if (item.expiryDate && isDateLike(item.expiryDate)) {
    return { expiryDate: formatDay(toDayMs(item.expiryDate)), confidence: 'Known' }
  }
  if (item.purchaseDate && isDateLike(item.purchaseDate) && item.category) {
    const prior = getShelfLifePrior(item.category)
    if (prior !== null) {
      return {
        expiryDate: addDays(item.purchaseDate, prior),
        confidence: 'Estimated (prior)',
      }
    }
  }
  return { expiryDate: null, confidence: null }
}

/**
 * Derive a learned daily-use rate from consumed events (FR-09).
 * Returns { value, eventCount, daysObserved } or null when fewer than
 * MIN_LEARNING_EVENTS consumed events exist.
 */
export function deriveLearnedDailyUse(events) {
  const consumed = (events ?? []).filter(
    (e) =>
      e &&
      e.eventType === 'consumed' &&
      typeof e.quantity === 'number' &&
      e.quantity > 0 &&
      isDateLike(e.timestamp),
  )
  if (consumed.length < MIN_LEARNING_EVENTS) return null
  const dayMs = consumed.map((e) => toDayMs(e.timestamp))
  const span = Math.max(1, Math.round((Math.max(...dayMs) - Math.min(...dayMs)) / DAY_MS))
  const total = consumed.reduce((sum, e) => sum + e.quantity, 0)
  return { value: total / span, eventCount: consumed.length, daysObserved: span }
}

/**
 * Resolve daily use by the §6.3 precedence: user-entered → learned (item or
 * category events) → configured category prior → null. Returns
 * { value, source, label } with source 'User' | 'Learned' | 'Prior' | null.
 */
export function resolveDailyUse(item, events = [], categoryDailyUsePriors = {}) {
  if (typeof item.averageDailyUse === 'number' && item.averageDailyUse > 0) {
    return { value: item.averageDailyUse, source: 'User', label: null }
  }
  const scoped = (events ?? []).filter(
    (e) => e && (e.itemId === item.id || e.category === item.category),
  )
  const learned = deriveLearnedDailyUse(scoped)
  if (learned) {
    return {
      value: learned.value,
      source: 'Learned',
      label: `Learned (${learned.eventCount} events)`,
    }
  }
  const prior = categoryDailyUsePriors[item.category]
  if (typeof prior === 'number' && prior > 0) {
    return { value: prior, source: 'Prior', label: 'Estimated (prior)' }
  }
  return { value: null, source: null, label: null }
}

// FR-10 (P1) confidence, derived from provenance.
function confidenceFor(expiryConfidence, dailyUseSource) {
  if (
    expiryConfidence === 'Known' &&
    (dailyUseSource === 'User' || dailyUseSource === 'Learned')
  ) {
    return 'High confidence'
  }
  return 'Partial'
}

// Reason codes mirror the §7 LLM-contract example: value-derived codes, so
// the Milk scenario yields exactly EXPIRY_1_DAY, EXCESS_75_PCT,
// USE_RATE_USER_ENTERED.
function reasonCodesFor({ daysLeft, excessScore, dailyUseSource, expiryConfidence }) {
  const codes = []
  if (daysLeft < 0) codes.push('EXPIRY_PAST_DUE')
  else if (daysLeft === 0) codes.push('EXPIRY_TODAY')
  else codes.push(`EXPIRY_${daysLeft}_DAY`)
  codes.push(`EXCESS_${excessScore}_PCT`)
  if (dailyUseSource === 'User') codes.push('USE_RATE_USER_ENTERED')
  else if (dailyUseSource === 'Learned') codes.push('USE_RATE_LEARNED')
  else if (dailyUseSource === 'Prior') codes.push('USE_RATE_PRIOR')
  if (expiryConfidence === 'Estimated (prior)') codes.push('EXPIRY_ESTIMATED')
  return codes
}

/**
 * Score one item. Returns one of:
 * - { status: 'scored', itemId, daysLeft, urgency, expectedUseBeforeExpiry,
 *     excessQuantity, excessScore, riskScore, band, expiryDate,
 *     expiryConfidence, dailyUse, dailyUseSource, dailyUseLabel, confidence,
 *     reasonCodes }
 * - { status: 'not-scored', itemId, reasonCodes } for quantityRemaining 0
 *   (ZERO_QUANTITY) or an invalid quantity (INVALID_QUANTITY).
 * - { status: 'insufficient-data', itemId, missing, expiryConfidence,
 *     dailyUseSource, reasonCodes } when no usable expiry or no daily-use
 *   value exists. `missing` names the gaps ('expiry' and/or 'daily-use').
 */
export function scoreItem(item, currentDate, options = {}) {
  const today = currentDate ? formatDay(toDayMs(currentDate)) : todayKey()
  const qty = item.quantityRemaining

  if (typeof qty !== 'number' || Number.isNaN(qty) || qty < 0) {
    return { itemId: item.id, status: 'not-scored', reasonCodes: ['INVALID_QUANTITY'] }
  }
  if (qty === 0) {
    return { itemId: item.id, status: 'not-scored', reasonCodes: ['ZERO_QUANTITY'] }
  }

  const expiry = resolveExpiry(item)
  const daily = resolveDailyUse(
    item,
    item.events ?? [],
    options.categoryDailyUsePriors ?? {},
  )
  const missing = []
  if (!expiry.expiryDate) missing.push('expiry')
  if (daily.value === null) missing.push('daily-use')
  if (missing.length > 0) {
    return {
      itemId: item.id,
      status: 'insufficient-data',
      missing,
      expiryConfidence: expiry.confidence,
      dailyUseSource: daily.source,
      reasonCodes: ['INSUFFICIENT_DATA'],
    }
  }

  const daysLeft = daysBetween(today, expiry.expiryDate)
  const urgency = urgencyFor(daysLeft)
  const expectedUseBeforeExpiry = daily.value * Math.max(daysLeft, 0)
  const excessQuantity = Math.max(qty - expectedUseBeforeExpiry, 0)
  const excessScore = Math.round((100 * excessQuantity) / qty)
  const riskScore = Math.round(URGENCY_WEIGHT * urgency + EXCESS_WEIGHT * excessScore)

  return {
    itemId: item.id,
    status: 'scored',
    daysLeft,
    urgency,
    expectedUseBeforeExpiry,
    excessQuantity,
    excessScore,
    riskScore,
    band: bandFor(riskScore),
    expiryDate: expiry.expiryDate,
    expiryConfidence: expiry.confidence,
    dailyUse: daily.value,
    dailyUseSource: daily.source,
    dailyUseLabel: daily.label,
    confidence: confidenceFor(expiry.confidence, daily.source),
    reasonCodes: reasonCodesFor({
      daysLeft,
      excessScore,
      dailyUseSource: daily.source,
      expiryConfidence: expiry.confidence,
    }),
  }
}

/**
 * Ordering for the Use Soon list (§6.1): descending riskScore, then earlier
 * expiry, then larger excessQuantity, then item id ascending. Unscored items
 * sort after scored ones (Module 3 separates them into "Needs information"
 * anyway); unscored pairs order by id for determinism.
 */
export function compareItems(a, b) {
  const aScored = a.status === 'scored'
  const bScored = b.status === 'scored'
  if (aScored !== bScored) return aScored ? -1 : 1
  if (!aScored && !bScored) return String(a.itemId).localeCompare(String(b.itemId))
  if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore
  if (a.expiryDate !== b.expiryDate) return a.expiryDate < b.expiryDate ? -1 : 1
  if (a.excessQuantity !== b.excessQuantity) return b.excessQuantity - a.excessQuantity
  return String(a.itemId).localeCompare(String(b.itemId))
}
