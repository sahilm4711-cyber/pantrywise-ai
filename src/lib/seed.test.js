import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { SHELF_LIFE_PRIORS_DAYS } from './priors.js'
import { resolveExpiry, scoreItem } from './riskEngine.js'
import { createMemoryStorage, createStore } from './store.js'

const TODAY = '2026-10-24'

test('seed creates exactly 40 inventory items and 5 shopping-list items', () => {
  const seed = buildSeed(TODAY)
  assert.equal(seed.items.length, 40)
  assert.equal(seed.shoppingList.length, 5)
  assert.equal(seed.events.length, 3)
})

test('seed spans all 9 shelf-life categories', () => {
  const seed = buildSeed(TODAY)
  const categories = new Set(seed.items.map((item) => item.category))
  assert.deepEqual(
    [...categories].sort(),
    Object.keys(SHELF_LIFE_PRIORS_DAYS).sort(),
  )
})

test('seed Milk still scores exactly 84 / High (the PRD §7 example)', () => {
  const seed = buildSeed(TODAY)
  const milk = seed.items.find((item) => item.name === 'Milk')
  const scored = scoreItem(milk, TODAY)
  assert.equal(scored.status, 'scored')
  assert.equal(scored.riskScore, 84)
  assert.equal(scored.band, 'High')
})

test('Tomatoes (purchase date, no expiry) estimate from the Fruits prior', () => {
  const seed = buildSeed(TODAY)
  const tomatoes = seed.items.find((item) => item.name === 'Tomatoes')
  assert.equal(tomatoes.purchaseDate, '2026-10-22')
  assert.equal(tomatoes.expiryDate, null)
  const resolved = resolveExpiry(tomatoes)
  assert.equal(resolved.confidence, 'Estimated (prior)')
  assert.equal(resolved.expiryDate, '2026-10-28')
})

test('Salt (neither date) is insufficient-data', () => {
  const seed = buildSeed(TODAY)
  const salt = seed.items.find((item) => item.name === 'Salt')
  assert.equal(salt.purchaseDate, null)
  assert.equal(salt.expiryDate, null)
  const scored = scoreItem(salt, TODAY)
  assert.equal(scored.status, 'insufficient-data')
  assert.ok(scored.missing.includes('expiry'))
})

test('Curd learns its daily use from its 3 consumed events', () => {
  const seed = buildSeed(TODAY)
  const curd = seed.items.find((item) => item.name === 'Curd')
  assert.equal(curd.quantityRemaining, 0.5)
  assert.equal(curd.status, 'partially consumed')
  const scored = scoreItem({ ...curd, events: seed.events }, TODAY)
  assert.equal(scored.status, 'scored')
  assert.equal(scored.dailyUse, 0.5)
  assert.equal(scored.dailyUseSource, 'Learned')
  assert.equal(scored.dailyUseLabel, 'Learned (3 events)')
  assert.equal(scored.riskScore, 45)
  assert.equal(scored.band, 'Medium')
})

test('shopping list covers the 5 FR-07 scenarios', () => {
  const seed = buildSeed(TODAY)
  assert.deepEqual(
    seed.shoppingList.map((item) => item.name),
    ['Milk', 'Bread pack', 'Rice', 'Bananas', 'Oats'],
  )
  const rice = seed.shoppingList.find((item) => item.name === 'Rice')
  assert.equal(rice.quantityWanted, 2)
  assert.equal(rice.unit, 'kg')
})

test('seeded data persists across a simulated refresh', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)
  store.seedDemo(TODAY)
  const reloaded = createStore(storage)
  assert.equal(reloaded.getState().items.length, 40)
  assert.equal(reloaded.getState().shoppingList.length, 5)
  assert.equal(reloaded.getState().events.length, 3)
})
