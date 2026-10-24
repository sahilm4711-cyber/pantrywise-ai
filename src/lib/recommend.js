// Shopping recommendations — PRD v1.3 §6.2 rules and FR-05.
// Every recommendation carries at least one reason code and the facts that
// triggered it (FR-05 acceptance); the UI renders exactly those, never an
// unexplained verdict.
//
// Precedence (the §6.2 table's rows, with the pipeline's data-quality
// gates evaluated first — §6.4 routes fuzzy matches and unconvertible
// units to Review before any action rule applies):
//  1. No match → Keep on list.
//  2. Fuzzy match → Review data (probable, never an automatic action).
//  3. No usable daily-use value → Review data.
//  4. Unconvertible units → Review data.
//  5. Matched item RiskScore ≥ 70 → Use soon.
//  6. stockCover ≥ 7 → Skip duplicate.
//  7. 3 ≤ stockCover < 7 → Buy less (suggested = max(wanted − remaining, 0),
//     in the list item's unit after conversion).
//  8. stockCover < 3 → Keep on list.
// Note on step 5: a matched item with unknown expiry has no RiskScore, so
// step 5 is skipped and the cover rules decide (a 20-day salt stock still
// means Skip, score or no score).

import { findMatch } from './duplicates.js'
import { HIGH_THRESHOLD, resolveDailyUse, scoreItem } from './riskEngine.js'
import { convertQuantity } from './units.js'

export const STOCK_COVER_LOW = 3
export const STOCK_COVER_HIGH = 7

function round2(n) {
  return Math.round(n * 100) / 100
}

export const RECOMMENDATION_REASON_TEXT = {
  MATCH_EXACT: 'Exact name match',
  MATCH_VARIANT: 'Same item, different name',
  MATCH_FUZZY: 'Probable match — check it',
  NO_MATCH: 'Not in inventory',
  ITEM_USE_SOON: 'Already urgent in inventory',
  STOCK_ADEQUATE: 'Stocked for 7+ days',
  STOCK_PARTIAL: 'Stocked for 3–7 days',
  STOCK_LOW: 'Less than 3 days of stock',
  UNIT_MISMATCH: 'Units cannot be compared',
  NO_DAILY_USE: 'Daily use unknown',
}

export function recommendationReasonText(code) {
  return RECOMMENDATION_REASON_TEXT[code] ?? code
}

export function recommendForListItem(
  listItem,
  items,
  events = [],
  currentDate,
  options = {},
) {
  const match = findMatch(listItem.name, items)
  if (match.kind === 'none') {
    return {
      type: 'keep',
      label: 'Keep on list',
      reasonCodes: ['NO_MATCH'],
      facts: {},
      matchedItem: null,
      match,
    }
  }
  if (match.kind === 'fuzzy') {
    return {
      type: 'review',
      label: 'Review data',
      reasonCodes: ['MATCH_FUZZY'],
      facts: {
        similarity: round2(match.similarity),
        matchedItemId: match.item.id,
        matchedItemName: match.item.name,
      },
      matchedItem: match.item,
      match,
    }
  }
  const item = match.item
  const matchCode = match.kind === 'exact' ? 'MATCH_EXACT' : 'MATCH_VARIANT'
  const baseFacts = {
    matchedItemId: item.id,
    matchedItemName: item.name,
    matchedQuantity: item.quantityRemaining,
    matchedUnit: item.unit,
  }
  const daily = resolveDailyUse(
    item,
    events,
    options.categoryDailyUsePriors ?? {},
  )
  if (daily.value === null) {
    return {
      type: 'review',
      label: 'Review data',
      reasonCodes: [matchCode, 'NO_DAILY_USE'],
      facts: baseFacts,
      matchedItem: item,
      match,
    }
  }
  const remainingInListUnit = convertQuantity(
    item.quantityRemaining,
    item.unit,
    listItem.unit,
  )
  if (remainingInListUnit === null) {
    return {
      type: 'review',
      label: 'Review data',
      reasonCodes: [matchCode, 'UNIT_MISMATCH'],
      facts: baseFacts,
      matchedItem: item,
      match,
    }
  }
  const stockCover = item.quantityRemaining / daily.value
  const facts = {
    ...baseFacts,
    stockCover: round2(stockCover),
    dailyUse: daily.value,
  }
  const scored = scoreItem({ ...item, events }, currentDate, options)
  const riskScore = scored.status === 'scored' ? scored.riskScore : null
  if (riskScore !== null) facts.riskScore = riskScore
  if (riskScore !== null && riskScore >= HIGH_THRESHOLD) {
    return {
      type: 'use-soon',
      label: 'Use soon',
      reasonCodes: [matchCode, 'ITEM_USE_SOON'],
      facts,
      matchedItem: item,
      match,
    }
  }
  if (stockCover >= STOCK_COVER_HIGH) {
    return {
      type: 'skip',
      label: 'Skip duplicate',
      reasonCodes: [matchCode, 'STOCK_ADEQUATE'],
      facts,
      matchedItem: item,
      match,
    }
  }
  if (stockCover >= STOCK_COVER_LOW) {
    return {
      type: 'buy-less',
      label: 'Buy less',
      reasonCodes: [matchCode, 'STOCK_PARTIAL'],
      facts: {
        ...facts,
        suggestedQuantity: round2(
          Math.max(listItem.quantityWanted - remainingInListUnit, 0),
        ),
        suggestedUnit: listItem.unit,
      },
      matchedItem: item,
      match,
    }
  }
  return {
    type: 'keep',
    label: 'Keep on list',
    reasonCodes: [matchCode, 'STOCK_LOW'],
    facts,
    matchedItem: item,
    match,
  }
}

export function recommendAll(
  listItems,
  items,
  events = [],
  currentDate,
  options = {},
) {
  return listItems.map((listItem) => ({
    listItem,
    recommendation: recommendForListItem(
      listItem,
      items,
      events,
      currentDate,
      options,
    ),
  }))
}
