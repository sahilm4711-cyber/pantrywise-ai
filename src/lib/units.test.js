import test from 'node:test'
import assert from 'node:assert/strict'
import { convertQuantity, normalizeUnit } from './units.js'

test('mass, volume, and count conversions', () => {
  assert.equal(convertQuantity(1, 'kg', 'g'), 1000)
  assert.equal(convertQuantity(500, 'g', 'kg'), 0.5)
  assert.equal(convertQuantity(1, 'L', 'ml'), 1000)
  assert.equal(convertQuantity(250, 'ml', 'L'), 0.25)
  assert.equal(convertQuantity(1, 'dozen', 'pieces'), 12)
  assert.equal(convertQuantity(24, 'pieces', 'dozen'), 2)
})

test('same-unit conversion is identity; units are case-insensitive', () => {
  assert.equal(convertQuantity(2, 'kg', 'kg'), 2)
  assert.equal(convertQuantity(1, 'KG', 'G'), 1000)
  assert.equal(convertQuantity(1, 'L', 'ML'), 1000)
  assert.equal(normalizeUnit(' Pieces '), 'pieces')
  assert.equal(normalizeUnit(''), null)
})

test('cross-dimension and unknown units are unconvertible (null)', () => {
  assert.equal(convertQuantity(1, 'kg', 'L'), null)
  assert.equal(convertQuantity(1, 'pieces', 'g'), null)
  assert.equal(convertQuantity(1, 'cups', 'g'), null)
  assert.equal(convertQuantity(1, 'kg', 'cups'), null)
})
