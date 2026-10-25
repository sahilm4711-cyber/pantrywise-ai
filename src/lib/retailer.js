// Retailer integration — PRD v1.3 FR-16 (P2).
// Ingests a retailer's purchase history (JSON array) via the FR-13
// fields: each line becomes an item with source = the retailer name
// and externalId = the retailer's line id. Lines already imported —
// same externalId already in inventory — are skipped, so re-importing
// a history never duplicates stock. No retailer-specific formats are
// claimed: any history in this shape is accepted.

import { inferCategory } from './receipt.js'

export function parseRetailerHistory(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { entries: [], errors: ['That file is not valid JSON.'] }
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], errors: ['Expected a JSON array of lines.'] }
  }
  const entries = []
  const errors = []
  parsed.forEach((line, index) => {
    const problems = []
    if (!line || typeof line !== 'object') {
      errors.push(`Line ${index + 1}: not an object.`)
      return
    }
    const name = typeof line.name === 'string' ? line.name.trim() : ''
    if (name === '') problems.push('name')
    const quantity = Number(line.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) problems.push('quantity')
    const unit = typeof line.unit === 'string' ? line.unit.trim() : ''
    if (unit === '') problems.push('unit')
    if (problems.length > 0) {
      errors.push(`Line ${index + 1}: missing ${problems.join(', ')}.`)
      return
    }
    const externalId =
      typeof line.externalId === 'string' && line.externalId.trim() !== ''
        ? line.externalId.trim()
        : null
    entries.push({
      name,
      quantity,
      unit,
      externalId,
      purchaseDate:
        typeof line.purchaseDate === 'string' ? line.purchaseDate : null,
      category: inferCategory(name),
      uncertain: inferCategory(name) ? [] : ['category'],
    })
  })
  return { entries, errors }
}

// Split entries into new stock vs already-imported lines. A line with
// no externalId can never match an earlier import, so it is always new.
export function dedupeRetailerEntries(entries, existingItems) {
  const known = new Set(
    existingItems.map((it) => it.externalId).filter((id) => id !== null),
  )
  const toAdd = []
  const skipped = []
  for (const entry of entries) {
    if (entry.externalId !== null && known.has(entry.externalId)) {
      skipped.push(entry)
    } else {
      toAdd.push(entry)
    }
  }
  return { toAdd, skipped }
}

export const SAMPLE_HISTORY = JSON.stringify(
  [
    { name: 'Milk', quantity: 1, unit: 'L', externalId: 'fm-1001' },
    { name: 'Rice', quantity: 5, unit: 'kg', externalId: 'fm-1002' },
    { name: 'Oats', quantity: 1, unit: 'kg' },
  ],
  null,
  2,
)
