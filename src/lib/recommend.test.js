import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { recommendAll, recommendForListItem } from './recommend.js'

const TODAY = '2026-10-24'

function seeded() {
  const seed = buildSeed(TODAY)
  return { items: seed.items, events: seed.events, list: seed.shoppingList }
}

function recFor(name, items, events, wanted, unit) {
  return recommendForListItem(
    { name, quantityWanted: wanted, unit },
    items,
    events,
    TODAY,
  )
}

test('seed scenarios: Use soon, Buy less, Skip, Keep', () => {
  const { items, events, list } = seeded()
  const byName = (name) => list.find((it) => it.name === name)
  const milk = recommendForListItem(byName('Milk'), items, events, TODAY)
  assert.equal(milk.type, 'use-soon')
  assert.ok(milk.reasonCodes.includes('ITEM_USE_SOON'))
  assert.equal(milk.facts.riskScore, 84)
  const bread = recommendForListItem(byName('Bread pack'), items, events, TODAY)
  assert.equal(bread.type, 'buy-less')
  assert.equal(bread.facts.suggestedQuantity, 0)
  assert.equal(bread.facts.suggestedUnit, 'pieces')
  const rice = recommendForListItem(byName('Rice'), items, events, TODAY)
  assert.equal(rice.type, 'skip')
  assert.equal(rice.facts.stockCover, 20)
  // Bananas scores 72, so the Use-soon row beats the Buy-less cover band.
  const bananas = recommendForListItem(byName('Bananas'), items, events, TODAY)
  assert.equal(bananas.type, 'use-soon')
  assert.equal(bananas.facts.riskScore, 72)
  const oats = recommendForListItem(byName('Oats'), items, events, TODAY)
  assert.equal(oats.type, 'keep')
  assert.deepEqual(oats.reasonCodes, ['NO_MATCH'])
})

test('every seed recommendation carries a reason code and facts', () => {
  const { items, events, list } = seeded()
  for (const { recommendation } of recommendAll(list, items, events, TODAY)) {
    assert.ok(recommendation.reasonCodes.length >= 1)
    assert.equal(typeof recommendation.facts, 'object')
  }
})

test('cross-unit Buy less converts before subtracting', () => {
  const { items, events } = seeded()
  const rec = recFor('Whole wheat bread', items, events, 2, 'dozen')
  assert.equal(rec.type, 'buy-less')
  assert.equal(rec.facts.suggestedQuantity, 1.92)
  assert.equal(rec.facts.suggestedUnit, 'dozen')
})

test('cross-dimension units route to Review data', () => {
  const { items, events } = seeded()
  const rec = recFor('Rice', items, events, 2, 'pieces')
  assert.equal(rec.type, 'review')
  assert.ok(rec.reasonCodes.includes('UNIT_MISMATCH'))
})

test('fuzzy matches route to Review data, never an automatic action', () => {
  const { items, events } = seeded()
  const rec = recFor('Bannanas', items, events, 5, 'pieces')
  assert.equal(rec.type, 'review')
  assert.ok(rec.reasonCodes.includes('MATCH_FUZZY'))
  assert.equal(rec.facts.similarity, 0.88)
})

test('no usable daily-use value routes to Review data', () => {
  const salt = {
    id: 'salt-x',
    name: 'Salt',
    category: 'Dry staples (rice, pulses, flour)',
    quantity: 1,
    quantityRemaining: 1,
    unit: 'kg',
    purchaseDate: null,
    expiryDate: null,
    averageDailyUse: null,
    status: 'active',
  }
  const rec = recFor('Salt', [salt], [], 1, 'kg')
  assert.equal(rec.type, 'review')
  assert.ok(rec.reasonCodes.includes('NO_DAILY_USE'))
})

test('unknown expiry but known daily use still follows the cover rules', () => {
  const salt = {
    id: 'salt-x',
    name: 'Salt',
    category: 'Dry staples (rice, pulses, flour)',
    quantity: 1,
    quantityRemaining: 1,
    unit: 'kg',
    purchaseDate: null,
    expiryDate: null,
    averageDailyUse: 0.05,
    status: 'active',
  }
  const rec = recFor('Salt', [salt], [], 1, 'kg')
  assert.equal(rec.type, 'skip')
  assert.equal(rec.facts.stockCover, 20)
})

test('recommendations change when inventory quantities change', () => {
  const { items, events } = seeded()
  const before = recFor('Bananas', items, events, 20, 'pieces')
  assert.equal(before.type, 'use-soon')
  const changed = items.map((item) =>
    item.name === 'Bananas' ? { ...item, quantityRemaining: 2 } : item,
  )
  const after = recFor('Bananas', changed, events, 20, 'pieces')
  assert.equal(after.type, 'keep')
  assert.ok(after.reasonCodes.includes('STOCK_LOW'))
})
