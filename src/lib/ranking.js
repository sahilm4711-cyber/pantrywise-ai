// Ranked scoring for the Use Soon list — PRD v1.3 FR-02, FR-03.
// Pure: score every item once (joining its events — the engine scopes
// learning to the item's own or same-category events), sort with the
// engine's compareItems, then partition. Use Soon is exactly the scored
// set with RiskScore >= HIGH_THRESHOLD (FR-03 acceptance);
// insufficient-data items are never hidden — they go to needsInfo with
// their missing fields named, for the "Needs information" section.

import { HIGH_THRESHOLD, compareItems, scoreItem } from './riskEngine.js'

export function scoreAllItems(items, events = [], currentDate, options = {}) {
  const scored = []
  const needsInfo = []
  const notScored = []
  for (const item of items) {
    const result = scoreItem({ ...item, events }, currentDate, options)
    const entry = { item, ...result }
    if (result.status === 'scored') scored.push(entry)
    else if (result.status === 'insufficient-data') needsInfo.push(entry)
    else notScored.push(entry)
  }
  scored.sort(compareItems)
  return {
    ranked: scored,
    useSoon: scored.filter((entry) => entry.riskScore >= HIGH_THRESHOLD),
    needsInfo,
    notScored,
  }
}
