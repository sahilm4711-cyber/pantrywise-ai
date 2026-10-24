// Dashboard metrics — PRD v1.3 FR-06.
// Pure composition over already-computed ranking and recommendations:
// recorded totals come ONLY from InventoryEvent rows (never from
// projections), and attention counts scored items only.
//
// Definitions:
// - activeCount: items with status active or partially consumed. Logging a
//   full discard moves an item to discarded, so active drops by exactly 1
//   (FR-06 acceptance).
// - attentionCount: scored items with RiskScore ≥ 40 (High + Medium).
// - duplicateAlerts: shopping items that match inventory in any way
//   (exact, variant, or fuzzy) — the list items that duplicate stock.
// - consumed/discarded totals: sums of logged event quantities, per the
//   FR-06 acceptance ("discarded total by that quantity"). Quantities keep
//   their items' units, so a mixed-unit total is a rough sum, not a
//   converted one.

export const ATTENTION_THRESHOLD = 40

export function computeMetrics({
  items,
  events,
  ranked = [],
  recommendations = [],
}) {
  const activeCount = items.filter(
    (item) =>
      item.status === 'active' || item.status === 'partially consumed',
  ).length
  const attentionCount = ranked.filter(
    (entry) => entry.riskScore >= ATTENTION_THRESHOLD,
  ).length
  const duplicateAlerts = recommendations.filter(
    (entry) =>
      entry.recommendation.match &&
      entry.recommendation.match.kind !== 'none',
  )
  const consumedEvents = events.filter((e) => e.eventType === 'consumed')
  const discardedEvents = events.filter((e) => e.eventType === 'discarded')
  const total = (list) => list.reduce((sum, e) => sum + e.quantity, 0)
  return {
    activeCount,
    attentionCount,
    duplicateAlertCount: duplicateAlerts.length,
    duplicateAlerts,
    consumedTotal: total(consumedEvents),
    discardedTotal: total(discardedEvents),
    consumedEventCount: consumedEvents.length,
    discardedEventCount: discardedEvents.length,
  }
}
