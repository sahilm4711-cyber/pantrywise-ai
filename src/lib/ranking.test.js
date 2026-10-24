import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { scoreAllItems } from './ranking.js'

const TODAY = '2026-10-24'

function seeded() {
  const seed = buildSeed(TODAY)
  return scoreAllItems(seed.items, seed.events, TODAY)
}

test('Use Soon is exactly the 6 High items, highest first', () => {
  const { useSoon } = seeded()
  assert.deepEqual(
    useSoon.map((entry) => entry.item.name),
    [
      'Dal (cooked)',
      'Spinach',
      'Methi',
      'Milk',
      'Vegetable sabzi',
      'Bananas',
    ],
  )
  assert.ok(useSoon.every((entry) => entry.riskScore >= 70))
})

test('ranked list covers all 39 scored items in descending score order', () => {
  const { ranked } = seeded()
  assert.equal(ranked.length, 39)
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].riskScore >= ranked[i].riskScore)
  }
  const bands = new Set(ranked.map((entry) => entry.band))
  assert.deepEqual([...bands].sort(), ['High', 'Low', 'Medium'])
  assert.equal(ranked.filter((e) => e.band === 'High').length, 6)
  assert.equal(ranked.filter((e) => e.band === 'Medium').length, 7)
  assert.equal(ranked.filter((e) => e.band === 'Low').length, 26)
})

test('top item is Dal (cooked) at 86', () => {
  const { ranked } = seeded()
  assert.equal(ranked[0].item.name, 'Dal (cooked)')
  assert.equal(ranked[0].riskScore, 86)
})

test('tie-break: same score and expiry orders by larger excess first', () => {
  const { ranked } = seeded()
  const index = (name) => ranked.findIndex((e) => e.item.name === name)
  // Both 46, both expire the same day: Chicken curry (excess 0.3) before Bread (0.25).
  assert.ok(index('Chicken curry') < index('Bread'))
  // Both 69, both expire the same day: Whole wheat bread (0.6) before Coriander (0.06).
  assert.ok(index('Whole wheat bread') < index('Coriander'))
})

test('insufficient-data items land in needsInfo, never in ranked/useSoon', () => {
  const { ranked, useSoon, needsInfo } = seeded()
  assert.deepEqual(
    needsInfo.map((entry) => entry.item.name),
    ['Salt'],
  )
  assert.deepEqual(needsInfo[0].missing, ['expiry'])
  assert.ok(!ranked.some((e) => e.item.name === 'Salt'))
  assert.ok(!useSoon.some((e) => e.item.name === 'Salt'))
})

test('confidence labels follow provenance (FR-10)', () => {
  const { ranked } = seeded()
  const find = (name) => ranked.find((e) => e.item.name === name)
  assert.equal(find('Milk').confidence, 'High confidence')
  assert.equal(find('Curd').confidence, 'High confidence')
  assert.equal(find('Tomatoes').confidence, 'Partial')
})

test('40-item ranking runs in under 500 ms (FR-02 NFR)', () => {
  const seed = buildSeed(TODAY)
  const start = Date.now()
  scoreAllItems(seed.items, seed.events, TODAY)
  assert.ok(Date.now() - start < 500)
})
