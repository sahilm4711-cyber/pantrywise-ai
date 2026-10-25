import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeRetailerEntries,
  parseRetailerHistory,
  SAMPLE_HISTORY,
} from './retailer.js'

test('sample history parses with inferred categories', () => {
  const { entries, errors } = parseRetailerHistory(SAMPLE_HISTORY)
  assert.deepEqual(errors, [])
  assert.equal(entries.length, 3)
  assert.equal(entries[0].category, 'Milk / dairy')
  assert.equal(entries[0].externalId, 'fm-1001')
  assert.equal(entries[2].externalId, null)
})

test('bad lines are reported, not imported', () => {
  const { entries, errors } = parseRetailerHistory(
    JSON.stringify([{ name: '', quantity: 1, unit: 'L' }, { name: 'Milk' }]),
  )
  assert.equal(entries.length, 0)
  assert.equal(errors.length, 2)
  assert.equal(parseRetailerHistory('nope').errors.length, 1)
  assert.equal(parseRetailerHistory('{}').errors.length, 1)
})

test('re-importing an externalId already in stock skips that line', () => {
  const existing = [{ externalId: 'fm-1001' }, { externalId: null }]
  const { entries } = parseRetailerHistory(SAMPLE_HISTORY)
  const { toAdd, skipped } = dedupeRetailerEntries(entries, existing)
  assert.equal(skipped.length, 1)
  assert.equal(skipped[0].externalId, 'fm-1001')
  assert.equal(toAdd.length, 2)
})

test('lines without an externalId can never match an earlier import', () => {
  const { entries } = parseRetailerHistory(
    JSON.stringify([{ name: 'Oats', quantity: 1, unit: 'kg' }]),
  )
  const { toAdd, skipped } = dedupeRetailerEntries(entries, [
    { externalId: 'anything' },
  ])
  assert.equal(toAdd.length, 1)
  assert.equal(skipped.length, 0)
})
