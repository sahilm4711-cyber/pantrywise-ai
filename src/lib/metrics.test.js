import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { scoreAllItems } from './ranking.js'
import { recommendAll } from './recommend.js'
import { computeMetrics } from './metrics.js'
import { createMemoryStorage, createStore } from './store.js'

const TODAY = '2026-10-24'

function metricsOfState(items, events, shoppingList) {
  const ranking = scoreAllItems(items, events, TODAY)
  const recs = recommendAll(shoppingList, items, events, TODAY)
  return computeMetrics({
    items,
    events,
    ranked: ranking.ranked,
    recommendations: recs,
  })
}

function seededMetrics() {
  const seed = buildSeed(TODAY)
  return metricsOfState(seed.items, seed.events, seed.shoppingList)
}

test('seed metrics: active, attention, alerts, recorded totals', () => {
  const metrics = seededMetrics()
  assert.equal(metrics.activeCount, 40)
  assert.equal(metrics.attentionCount, 13)
  assert.equal(metrics.duplicateAlertCount, 4)
  assert.deepEqual(
    metrics.duplicateAlerts.map((entry) => entry.listItem.name),
    ['Milk', 'Bread pack', 'Rice', 'Bananas'],
  )
  assert.equal(metrics.consumedTotal, 1.5)
  assert.equal(metrics.consumedEventCount, 3)
  assert.equal(metrics.discardedTotal, 0)
  assert.equal(metrics.discardedEventCount, 0)
})

test('FR-06 acceptance: discarding one item drops active by 1 and raises discarded total by its quantity', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)
  store.seedDemo(TODAY)
  const stateOf = () => {
    const s = store.getState()
    return metricsOfState(s.items, s.events, s.shoppingList)
  }
  const before = stateOf()
  const milk = store.getState().items.find((item) => item.name === 'Milk')
  const logged = store.logEvent({
    itemId: milk.id,
    eventType: 'discarded',
    quantity: milk.quantityRemaining,
  })
  assert.equal(logged.ok, true)
  const after = stateOf()
  assert.equal(after.activeCount, before.activeCount - 1)
  assert.equal(after.discardedTotal, before.discardedTotal + 2)
  assert.equal(after.discardedEventCount, before.discardedEventCount + 1)
})

test('attention threshold is inclusive at exactly 40', () => {
  const metrics = computeMetrics({
    items: [],
    events: [],
    ranked: [{ riskScore: 40 }, { riskScore: 39 }],
    recommendations: [],
  })
  assert.equal(metrics.attentionCount, 1)
})

test('empty state yields zeros without crashing', () => {
  const metrics = computeMetrics({
    items: [],
    events: [],
    ranked: [],
    recommendations: [],
  })
  assert.deepEqual(
    [
      metrics.activeCount,
      metrics.attentionCount,
      metrics.duplicateAlertCount,
      metrics.consumedTotal,
      metrics.discardedTotal,
    ],
    [0, 0, 0, 0, 0],
  )
})
