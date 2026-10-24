import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { scoreAllItems } from './ranking.js'
import { recommendAll } from './recommend.js'
import { computeMetrics } from './metrics.js'
import { createMemoryStorage, createStore } from './store.js'

// Module 6 — the judge walkthrough, end to end through the public APIs:
// seed → dashboard → shopping recommendations → inventory actions →
// metrics move → everything persists across a reload.

const TODAY = '2026-10-24'

function dashboardOf(store) {
  const s = store.getState()
  const ranking = scoreAllItems(s.items, s.events, TODAY)
  const recs = recommendAll(s.shoppingList, s.items, s.events, TODAY)
  return {
    ranking,
    recs,
    metrics: computeMetrics({
      items: s.items,
      events: s.events,
      ranked: ranking.ranked,
      recommendations: recs,
    }),
  }
}

test('judge walkthrough: seed, dashboard, shopping, actions, reload', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)

  // 1. Load demo data.
  store.seedDemo(TODAY)
  let view = dashboardOf(store)
  assert.equal(store.getState().items.length, 40)
  assert.equal(store.getState().shoppingList.length, 5)
  assert.equal(store.getState().demo, true)

  // 2. Dashboard: top 3, ranked, needs-information, metrics.
  assert.deepEqual(
    view.ranking.useSoon.slice(0, 3).map((e) => e.item.name),
    ['Dal (cooked)', 'Spinach', 'Methi'],
  )
  assert.equal(view.ranking.ranked.length, 39)
  assert.deepEqual(
    view.ranking.needsInfo.map((e) => e.item.name),
    ['Salt'],
  )
  assert.equal(view.metrics.activeCount, 40)
  assert.equal(view.metrics.attentionCount, 13)
  assert.equal(view.metrics.duplicateAlertCount, 4)
  assert.equal(view.metrics.consumedTotal, 1.5)
  assert.equal(view.metrics.discardedTotal, 0)

  // 3. Shopping recommendations for all 5 list items.
  const recByName = new Map(
    view.recs.map(({ listItem, recommendation }) => [
      listItem.name,
      recommendation,
    ]),
  )
  assert.equal(recByName.get('Milk').type, 'use-soon')
  assert.equal(recByName.get('Bread pack').type, 'buy-less')
  assert.equal(recByName.get('Rice').type, 'skip')
  assert.equal(recByName.get('Bananas').type, 'use-soon')
  assert.equal(recByName.get('Oats').type, 'keep')

  // 4. Inventory action: use half the Milk — its score moves 84 → 81,
  // still High, and the dashboard re-ranks without a reload.
  const milk = store.getState().items.find((item) => item.name === 'Milk')
  assert.equal(
    store.logEvent({ itemId: milk.id, eventType: 'consumed', quantity: 0.5 })
      .ok,
    true,
  )
  view = dashboardOf(store)
  const milkNow = view.ranking.ranked.find((e) => e.item.name === 'Milk')
  assert.equal(milkNow.riskScore, 81)
  assert.equal(milkNow.band, 'High')
  assert.equal(view.metrics.consumedTotal, 2.0)

  // 5. Discard the rest of the Milk — active drops by 1, discarded rises.
  assert.equal(
    store.logEvent({ itemId: milk.id, eventType: 'discarded', quantity: 1.5 })
      .ok,
    true,
  )
  view = dashboardOf(store)
  assert.equal(view.metrics.activeCount, 39)
  assert.equal(view.metrics.discardedTotal, 1.5)

  // 6. Reload: everything persists, including events and the demo label.
  const reloaded = createStore(storage)
  assert.equal(reloaded.getState().items.length, 40)
  assert.equal(reloaded.getState().events.length, 5)
  assert.equal(reloaded.getState().demo, true)
  const reloadedMilk = reloaded
    .getState()
    .items.find((item) => item.name === 'Milk')
  assert.equal(reloadedMilk.status, 'discarded')
  assert.equal(reloadedMilk.quantityRemaining, 0)
})

test('demo flag lifecycle: seed sets it, edits keep it, clear removes it', () => {
  const store = createStore(createMemoryStorage())
  assert.equal(store.getState().demo, false)
  store.seedDemo(TODAY)
  assert.equal(store.getState().demo, true)
  store.addItem({
    name: 'Oats',
    category: 'Dry staples (rice, pulses, flour)',
    quantity: 1,
    unit: 'kg',
  })
  assert.equal(store.getState().demo, true)
  store.clearAll()
  assert.equal(store.getState().demo, false)
})

test('legacy saved states without the flag are recognised by seed ids', () => {
  const storage = createMemoryStorage()
  const seed = buildSeed(TODAY)
  storage.setItem(
    'pantrywise-ai-v1',
    JSON.stringify({
      schemaVersion: 1,
      items: seed.items,
      events: seed.events,
      shoppingList: seed.shoppingList,
    }),
  )
  const store = createStore(storage)
  assert.equal(store.getState().demo, true)
})

test('200-item recompute stays under the 500 ms budget (FR-02 NFR)', () => {
  const seed = buildSeed(TODAY)
  const items200 = []
  for (let k = 0; k < 5; k += 1) {
    for (const item of seed.items) {
      items200.push({ ...item, id: `${item.id}-${k}` })
    }
  }
  const start = Date.now()
  const result = scoreAllItems(items200, seed.events, TODAY)
  assert.ok(Date.now() - start < 500)
  assert.equal(result.ranked.length, 195)
})
