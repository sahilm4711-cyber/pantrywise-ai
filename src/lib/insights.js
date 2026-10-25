// Historical insights — PRD v1.3 FR-11 (P1).
// Trends render only once at least 5 events exist; below that the UI
// shows an empty state (FR-11 acceptance: 4 events → empty, 5 → trends).
// Everything derives from InventoryEvent rows only — recorded history,
// never score projections.

export const TREND_THRESHOLD = 5

export function computeInsights(events) {
  const consumed = events.filter((e) => e.eventType === 'consumed')
  const discarded = events.filter((e) => e.eventType === 'discarded')
  const total = (list) => list.reduce((sum, e) => sum + e.quantity, 0)
  const byCategoryMap = new Map()
  for (const e of events) {
    const row = byCategoryMap.get(e.category) ?? {
      category: e.category,
      consumed: 0,
      discarded: 0,
      events: 0,
    }
    if (e.eventType === 'consumed') row.consumed += e.quantity
    if (e.eventType === 'discarded') row.discarded += e.quantity
    row.events += 1
    byCategoryMap.set(e.category, row)
  }
  const byCategory = [...byCategoryMap.values()].sort(
    (a, b) =>
      b.consumed + b.discarded - (a.consumed + a.discarded) ||
      a.category.localeCompare(b.category),
  )
  return {
    eventCount: events.length,
    hasTrends: events.length >= TREND_THRESHOLD,
    consumedTotal: total(consumed),
    discardedTotal: total(discarded),
    consumedCount: consumed.length,
    discardedCount: discarded.length,
    byCategory,
  }
}

// FR-15 (P2): per-member activity. Member names are snapshotted on
// events, so history survives renames and removals; members with no
// events still appear with zeros.
export function computeMemberStats(events, members) {
  const rows = new Map()
  for (const m of members) {
    rows.set(m.id, {
      memberId: m.id,
      memberName: m.name,
      events: 0,
      consumed: 0,
      discarded: 0,
    })
  }
  for (const e of events) {
    const key = e.memberId ?? `name:${e.memberName ?? 'Unattributed'}`
    const row = rows.get(key) ?? {
      memberId: e.memberId ?? null,
      memberName: e.memberName ?? 'Unattributed',
      events: 0,
      consumed: 0,
      discarded: 0,
    }
    row.events += 1
    if (e.eventType === 'consumed') row.consumed += e.quantity
    if (e.eventType === 'discarded') row.discarded += e.quantity
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.events - a.events)
}
