import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReceipt, SAMPLE_RECEIPT } from './receipt.js'

test('sample receipt: 6 items, totals and header skipped', () => {
  const { lines, skipped } = parseReceipt(SAMPLE_RECEIPT)
  assert.equal(lines.length, 6)
  assert.equal(skipped, 3) // Fresh Mart header, TOTAL, Thank you
  const names = lines.map((l) => l.name)
  assert.deepEqual(names, [
    'Milk',
    'Bread',
    'Rice',
    'Eggs',
    'Tomatoes',
    'Dragon fruit',
  ])
})

test('certain lines carry name, quantity, unit, and category', () => {
  const { lines } = parseReceipt(SAMPLE_RECEIPT)
  const milk = lines[0]
  assert.equal(milk.quantity, 1)
  assert.equal(milk.unit, 'L')
  assert.equal(milk.category, 'Milk / dairy')
  assert.deepEqual(milk.uncertain, [])
  const rice = lines[2]
  assert.equal(rice.quantity, 5)
  assert.equal(rice.unit, 'kg')
  assert.equal(rice.category, 'Dry staples (rice, pulses, flour)')
})

test('packaging words flag the unit, not the name', () => {
  const { lines } = parseReceipt(SAMPLE_RECEIPT)
  const bread = lines[1]
  assert.equal(bread.quantity, 2)
  assert.equal(bread.unit, null)
  assert.deepEqual(bread.uncertain, ['unit'])
  assert.equal(bread.category, 'Bread')
})

test('unknown items flag the category; missing units flag the unit', () => {
  const { lines } = parseReceipt('Mystery beans 3\nSalt 1 kg')
  assert.deepEqual(lines[0].uncertain, ['unit', 'category'])
  assert.equal(lines[0].quantity, 3)
  assert.deepEqual(lines[1].uncertain, [])
})

test('a line with no number flags quantity and unit', () => {
  const { lines } = parseReceipt('Milk')
  // Single-line input: the header heuristic skips it, so use two lines.
  const two = parseReceipt('Fresh Mart\nMilk')
  assert.equal(two.lines.length, 1)
  assert.deepEqual(two.lines[0].uncertain, ['quantity', 'unit'])
  assert.equal(two.lines[0].name, 'Milk')
  assert.equal(lines.length, 0)
})
