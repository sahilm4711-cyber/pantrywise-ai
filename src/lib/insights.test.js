import test from 'node:test'
import assert from 'node:assert/strict'
import { computeInsights, computeMemberStats } from './insights.js'

function event(overrides = {}) {
  return {
    id: 'e1',
    itemId: 'i1',
    category: 'Milk / dairy',
    eventType: 'consumed',
    quantity: 0.5,
    timestamp: '2026-10-24',
    ...overrides,
  }
}

test('FR-11 acceptance: 4 events show the empty state', () => {
  const events = [
    event({ id: 'e1' }),
    event({ id: 'e2' }),
    event({ id: 'e3' }),
    event({ id: 'e4', eventType: 'discarded' }),
  ]
  const insights = computeInsights(events)
  assert.equal(insights.eventCount, 4)
  assert.equal(insights.hasTrends, false)
})

test('FR-11 acceptance: 5 events render the trend view', () => {
  const events = [
    event({ id: 'e1' }),
    event({ id: 'e2' }),
    event({ id: 'e3' }),
    event({ id: 'e4', eventType: 'discarded' }),
    event({ id: 'e5', category: 'Bread', quantity: 1 }),
  ]
  const insights = computeInsights(events)
  assert.equal(insights.eventCount, 5)
  assert.equal(insights.hasTrends, true)
  assert.equal(insights.consumedTotal, 2.5)
  assert.equal(insights.discardedTotal, 0.5)
  assert.equal(insights.consumedCount, 4)
  assert.equal(insights.discardedCount, 1)
})

test('by-category breakdown splits consumed and discarded', () => {
  const events = [
    event({ id: 'e1', quantity: 1 }),
    event({ id: 'e2', category: 'Bread', quantity: 2 }),
    event({ id: 'e3', eventType: 'discarded', quantity: 0.25 }),
  ]
  const { byCategory } = computeInsights(events)
  assert.deepEqual(
    byCategory.map((row) => row.category),
    ['Bread', 'Milk / dairy'],
  )
  const milk = byCategory.find((row) => row.category === 'Milk / dairy')
  assert.equal(milk.consumed, 1)
  assert.equal(milk.discarded, 0.25)
  assert.equal(milk.events, 2)
})

test('empty event log yields zeros without trends', () => {
  const insights = computeInsights([])
  assert.equal(insights.hasTrends, false)
  assert.equal(insights.consumedTotal, 0)
  assert.equal(insights.discardedTotal, 0)
  assert.deepEqual(insights.byCategory, [])
})

// P2 — FR-15 member stats.
test('computeMemberStats joins members and snapshots', () => {
  const members = [
    { id: 'm1', name: 'Priya' },
    { id: 'm2', name: 'Rohan' },
  ]
  const events = [
    event({ id: 'e1', memberId: 'm1', memberName: 'Priya', quantity: 1 }),
    event({
      id: 'e2',
      memberId: 'm1',
      memberName: 'Priya',
      eventType: 'discarded',
      quantity: 0.5,
    }),
    event({ id: 'e3', memberId: null, memberName: null, quantity: 2 }),
  ]
  const stats = computeMemberStats(events, members)
  assert.equal(stats.length, 3)
  const priya = stats.find((s) => s.memberName === 'Priya')
  assert.equal(priya.events, 2)
  assert.equal(priya.consumed, 1)
  assert.equal(priya.discarded, 0.5)
  const rohan = stats.find((s) => s.memberName === 'Rohan')
  assert.equal(rohan.events, 0)
  const unattributed = stats.find((s) => s.memberName === 'Unattributed')
  assert.equal(unattributed.events, 1)
})
