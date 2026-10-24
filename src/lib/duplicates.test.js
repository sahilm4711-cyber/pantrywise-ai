import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canonicalName,
  evaluateFixtures,
  findMatch,
  levenshtein,
  matchPair,
  normalizeName,
  similarity,
} from './duplicates.js'
import { DUPLICATE_FIXTURES } from './duplicateFixtures.js'
import { buildSeed } from './seed.js'

test('normalization lowercases, spaces punctuation, collapses whitespace', () => {
  assert.equal(normalizeName('  Whole-Wheat  Bread! '), 'whole wheat bread')
  assert.equal(normalizeName('Dal (cooked)'), 'dal cooked')
})

test('packaging words and phrases strip to the base name', () => {
  assert.equal(canonicalName('Milk pack'), 'milk')
  assert.equal(canonicalName('Milk pkt'), 'milk')
  assert.equal(canonicalName('Milk packet'), 'milk')
  assert.equal(canonicalName('Bottle of milk'), 'milk')
  assert.equal(canonicalName('Tin of beans'), 'beans')
  assert.equal(canonicalName('Packet of milk'), 'milk')
})

test('aliases resolve both ways to one canonical name', () => {
  assert.equal(canonicalName('Dahi'), 'curd')
  assert.equal(canonicalName('Curd'), 'curd')
  assert.equal(canonicalName('Bell pepper'), 'capsicum')
  assert.equal(canonicalName('Capsicum'), 'capsicum')
})

test('levenshtein and similarity behave at the threshold', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3)
  assert.equal(levenshtein('', 'abc'), 3)
  assert.equal(similarity('milk', 'milk'), 1)
  assert.equal(similarity('bannanas', 'bananas'), 0.875)
  assert.equal(similarity('bred', 'bread'), 0.8)
})

test('matchPair distinguishes exact, variant, fuzzy, and none', () => {
  assert.deepEqual(matchPair('Milk', 'Milk'), { kind: 'exact', similarity: 1 })
  assert.deepEqual(matchPair('Milk pack', 'Milk'), {
    kind: 'variant',
    similarity: 1,
  })
  assert.equal(matchPair('Bannanas', 'Bananas').kind, 'fuzzy')
  assert.equal(matchPair('Milk', 'Milkshake').kind, 'none')
  assert.equal(matchPair('pack', 'Milk').kind, 'none')
})

test('findMatch on the seed: exact, variant, fuzzy, and absent', () => {
  const seed = buildSeed('2026-10-24')
  const milk = findMatch('Milk', seed.items)
  assert.equal(milk.kind, 'exact')
  assert.equal(milk.item.name, 'Milk')
  const bread = findMatch('Bread pack', seed.items)
  assert.equal(bread.kind, 'variant')
  assert.equal(bread.item.name, 'Bread')
  const typo = findMatch('Bannanas', seed.items)
  assert.equal(typo.kind, 'fuzzy')
  assert.equal(typo.item.name, 'Bananas')
  assert.equal(findMatch('Oats', seed.items).kind, 'none')
})

test('multiple exact matches resolve to the earliest expiry', () => {
  const items = [
    { id: 'b', name: 'Milk', expiryDate: '2026-10-30' },
    { id: 'a', name: 'Milk', expiryDate: '2026-10-25' },
  ]
  assert.equal(findMatch('Milk', items).item.id, 'a')
})

test('60-pair fixture meets the FR-04 KPI: precision ≥ 90%, recall ≥ 85%', () => {
  assert.equal(DUPLICATE_FIXTURES.length, 60)
  assert.equal(
    DUPLICATE_FIXTURES.filter((p) => p.duplicate).length,
    40,
  )
  const result = evaluateFixtures(DUPLICATE_FIXTURES)
  assert.equal(result.tp, 40)
  assert.equal(result.fp, 0)
  assert.equal(result.fn, 0)
  assert.deepEqual(result.failures, [])
  assert.ok(result.precision >= 0.9)
  assert.ok(result.recall >= 0.85)
})
