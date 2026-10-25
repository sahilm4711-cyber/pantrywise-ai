// Field-level validation for grocery items — PRD v1.3 FR-01.
// Returns { valid, errors, value }: errors maps field → message (for the
// form), value is the normalized item (trimmed strings, numbers, dates as
// YYYY-MM-DD or null). The store validates the MERGED item on edit, so one
// function covers add and edit.
//
// Rules: name, category, unit required; quantity a number > 0; remaining
// (when present) >= 0; dates, when present, real calendar dates; daily use,
// when present, > 0. Missing expiry is NOT an error — the engine estimates
// it from the category prior (FR-08); missing purchase date is allowed too
// (§6.6 scenario 4: dateless items are legitimate, scored insufficient-data).

import { isValidDateKey } from './dates.js'

function toNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value.trim())
  }
  return Number.NaN
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanDate(value) {
  const s = cleanString(value)
  return s === '' ? null : s
}

export function validateItemInput(input) {
  const errors = {}
  const name = cleanString(input.name)
  const category = cleanString(input.category)
  const unit = cleanString(input.unit)
  const quantity = toNumber(input.quantity)
  const rawRemaining = input.quantityRemaining
  const quantityRemaining =
    rawRemaining === undefined || rawRemaining === null || rawRemaining === ''
      ? null
      : toNumber(rawRemaining)
  const purchaseDate = cleanDate(input.purchaseDate)
  const expiryDate = cleanDate(input.expiryDate)
  const rawUse = input.averageDailyUse
  const averageDailyUse =
    rawUse === undefined || rawUse === null || rawUse === ''
      ? null
      : toNumber(rawUse)
  // FR-13 (P1): receipt-ready fields. Both optional; a missing source
  // means a manual item, a missing externalId means no outside record.
  // The store defaults them, the validator only normalizes them, so
  // imports (FR-12/FR-14/FR-16) can carry real values through.
  const source = cleanString(input.source) === '' ? 'manual' : cleanString(input.source)
  const externalId =
    typeof input.externalId === 'string' && input.externalId.trim() !== ''
      ? input.externalId.trim()
      : null

  if (name === '') errors.name = 'Name is required.'
  if (category === '') errors.category = 'Category is required.'
  if (unit === '') errors.unit = 'Unit is required.'
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = 'Quantity must be a number greater than 0.'
  }
  if (
    quantityRemaining !== null &&
    (!Number.isFinite(quantityRemaining) || quantityRemaining < 0)
  ) {
    errors.quantityRemaining = 'Quantity remaining cannot be negative.'
  }
  if (purchaseDate !== null && !isValidDateKey(purchaseDate)) {
    errors.purchaseDate = 'Purchase date is not a valid date.'
  }
  if (expiryDate !== null && !isValidDateKey(expiryDate)) {
    errors.expiryDate = 'Expiry date is not a valid date.'
  }
  if (
    averageDailyUse !== null &&
    (!Number.isFinite(averageDailyUse) || averageDailyUse <= 0)
  ) {
    errors.averageDailyUse = 'Daily use must be a number greater than 0.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      category,
      quantity,
      quantityRemaining,
      unit,
      purchaseDate,
      expiryDate,
      averageDailyUse,
      source,
      externalId,
    },
  }
}


// Shopping-list validation (FR-04/FR-05): a list item needs a name, a
// wanted quantity > 0, and a unit. No dates — those live on inventory.
export function validateShoppingItemInput(input) {
  const errors = {}
  const name = cleanString(input.name)
  const unit = cleanString(input.unit)
  const quantityWanted = toNumber(input.quantityWanted)
  if (name === '') errors.name = 'Name is required.'
  if (unit === '') errors.unit = 'Unit is required.'
  if (!Number.isFinite(quantityWanted) || quantityWanted <= 0) {
    errors.quantityWanted = 'Quantity must be a number greater than 0.'
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { name, quantityWanted, unit },
  }
}
