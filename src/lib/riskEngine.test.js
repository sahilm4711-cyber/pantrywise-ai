// Module 1 tests — PRD v1.3 §6.1, §6.3, FR-02, FR-08, FR-09.
// Run: npm test  (node --test, no extra dependencies)
// All dates are fixed so results are repeatable.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  bandFor,
  compareItems,
  deriveLearnedDailyUse,
  resolveDailyUse,
  scoreItem,
  urgencyFor,
} from './riskEngine.js'
import { getShelfLifePrior } from './priors.js'

const TODAY = '2026-10-24'

function milk(overrides = {}) {
  return {
    id: 'milk-1',
    category: 'Milk / dairy',
    quantityRemaining: 2.0,
    expiryDate: '2026-10-25',
    averageDailyUse: 0.5,
    ...overrides,
  }
}

describe('worked example (§6.1)', () => {
  it('Milk scores 84 / High with exact factors and PRD reason codes', () => {
    const r = scoreItem(milk(), TODAY)
    assert.equal(r.status, 'scored')
    assert.equal(r.daysLeft, 1)
    assert.equal(r.urgency, 90)
    assert.equal(r.expectedUseBeforeExpiry, 0.5)
    assert.equal(r.excessQuantity, 1.5)
    assert.equal(r.excessScore, 75)
    assert.equal(r.riskScore, 84)
    assert.equal(r.band, 'High')
    assert.equal(r.expiryConfidence, 'Known')
    assert.equal(r.dailyUseSource, 'User')
    assert.equal(r.confidence, 'High confidence')
    assert.deepEqual(r.reasonCodes, [
      'EXPIRY_1_DAY',
      'EXCESS_75_PCT',
      'USE_RATE_USER_ENTERED',
    ])
  })

  it('is deterministic and does not mutate its input', () => {
    const item = Object.freeze(milk())
    assert.deepEqual(scoreItem(item, TODAY), scoreItem(item, TODAY))
  })
})

describe('urgency table (§6.1)', () => {
  const cases = [
    [-2, 100],
    [0, 100],
    [1, 90],
    [2, 75],
    [3, 60],
    [4, 40],
    [5, 40],
    [6, 25],
    [7, 25],
    [8, 23],
    [19, 1],
    [20, 0],
    [30, 0],
  ]
  for (const [daysLeft, expected] of cases) {
    it(`daysLeft ${daysLeft} → U ${expected}`, () => {
      assert.equal(urgencyFor(daysLeft), expected)
    })
  }
})

describe('bands (§6.1)', () => {
  it('thresholds are exact', () => {
    assert.equal(bandFor(70), 'High')
    assert.equal(bandFor(69), 'Medium')
    assert.equal(bandFor(40), 'Medium')
    assert.equal(bandFor(39), 'Low')
  })

  it('full pipeline hits 70, 69, 40 and 39', () => {
    // 70: U90 + E40 → 54 + 16
    const s70 = scoreItem(
      milk({ quantityRemaining: 1.0, averageDailyUse: 0.6 }),
      TODAY,
    )
    assert.equal(s70.riskScore, 70)
    assert.equal(s70.band, 'High')
    // 69: U75 (2 days) + E60 → 45 + 24
    const s69 = scoreItem(
      milk({ quantityRemaining: 1.0, expiryDate: '2026-10-26', averageDailyUse: 0.2 }),
      TODAY,
    )
    assert.equal(s69.riskScore, 69)
    assert.equal(s69.band, 'Medium')
    // 40: U40 (4 days) + E40 → 24 + 16
    const s40 = scoreItem(
      milk({ quantityRemaining: 1.0, expiryDate: '2026-10-28', averageDailyUse: 0.15 }),
      TODAY,
    )
    assert.equal(s40.riskScore, 40)
    assert.equal(s40.band, 'Medium')
    // 39: U25 (6 days) + E60 → 15 + 24
    const s39 = scoreItem(
      milk({ quantityRemaining: 5.0, expiryDate: '2026-10-30', averageDailyUse: 1 / 3 }),
      TODAY,
    )
    assert.equal(s39.excessScore, 60)
    assert.equal(s39.riskScore, 39)
    assert.equal(s39.band, 'Low')
  })
})

describe('not scored (FR-02)', () => {
  it('zero quantity is not scored', () => {
    const r = scoreItem(milk({ quantityRemaining: 0 }), TODAY)
    assert.equal(r.status, 'not-scored')
    assert.deepEqual(r.reasonCodes, ['ZERO_QUANTITY'])
    assert.equal(r.riskScore, undefined)
  })

  it('negative quantity is not scored', () => {
    assert.equal(scoreItem(milk({ quantityRemaining: -1 }), TODAY).status, 'not-scored')
  })
})

describe('expiry estimation (FR-08)', () => {
  it('Bread with purchase date and no expiry yields D+4, Estimated (prior)', () => {
    const r = scoreItem(
      {
        id: 'bread-1',
        category: 'Bread',
        quantityRemaining: 1,
        purchaseDate: '2026-10-20',
        averageDailyUse: 0.25,
      },
      TODAY,
    )
    assert.equal(r.status, 'scored')
    assert.equal(r.expiryDate, '2026-10-24')
    assert.equal(r.expiryConfidence, 'Estimated (prior)')
    assert.equal(r.daysLeft, 0)
    assert.equal(r.riskScore, 100)
    assert.equal(r.confidence, 'Partial')
    assert.ok(r.reasonCodes.includes('EXPIRY_ESTIMATED'))
  })

  it('a real expiry date replaces the estimate and sets Known', () => {
    const r = scoreItem(milk({ purchaseDate: '2026-10-20' }), TODAY)
    assert.equal(r.expiryConfidence, 'Known')
    assert.equal(r.expiryDate, '2026-10-25')
  })

  it('neither date means insufficient-data', () => {
    const r = scoreItem(
      { id: 'x-1', category: 'Bread', quantityRemaining: 1, averageDailyUse: 0.25 },
      TODAY,
    )
    assert.equal(r.status, 'insufficient-data')
    assert.ok(r.missing.includes('expiry'))
  })

  it('unknown category with a purchase date but no expiry is insufficient', () => {
    const r = scoreItem(
      {
        id: 'x-2',
        category: 'Mystery food',
        quantityRemaining: 1,
        purchaseDate: '2026-10-20',
        averageDailyUse: 0.25,
      },
      TODAY,
    )
    assert.equal(r.status, 'insufficient-data')
  })
})

describe('daily-use precedence (§6.3, FR-09)', () => {
  const learnedEvents = (itemId = 'milk-1') => [
    { itemId, category: 'Milk / dairy', eventType: 'consumed', quantity: 0.5, timestamp: '2026-10-21' },
    { itemId, category: 'Milk / dairy', eventType: 'consumed', quantity: 0.5, timestamp: '2026-10-22' },
    { itemId, category: 'Milk / dairy', eventType: 'consumed', quantity: 0.5, timestamp: '2026-10-24' },
  ]

  it('3 events totalling 1.5 L over 3 observed days learn 0.5 L/day', () => {
    const d = deriveLearnedDailyUse(learnedEvents())
    assert.equal(d.value, 0.5)
    assert.equal(d.eventCount, 3)
    assert.equal(d.daysObserved, 3)
    const r = scoreItem(
      milk({ averageDailyUse: undefined, events: learnedEvents() }),
      TODAY,
    )
    assert.equal(r.status, 'scored')
    assert.equal(r.dailyUse, 0.5)
    assert.equal(r.dailyUseSource, 'Learned')
    assert.equal(r.dailyUseLabel, 'Learned (3 events)')
    assert.equal(r.riskScore, 84)
    assert.equal(r.confidence, 'High confidence')
  })

  it('a user-entered value overrides the learned value', () => {
    const r = scoreItem(
      milk({ averageDailyUse: 0.25, events: learnedEvents() }),
      TODAY,
    )
    assert.equal(r.dailyUse, 0.25)
    assert.equal(r.dailyUseSource, 'User')
  })

  it('fewer than 3 events fall through to the category prior, then insufficient', () => {
    const two = learnedEvents().slice(0, 2)
    assert.equal(deriveLearnedDailyUse(two), null)
    const noPrior = scoreItem(milk({ averageDailyUse: undefined, events: two }), TODAY)
    assert.equal(noPrior.status, 'insufficient-data')
    assert.ok(noPrior.missing.includes('daily-use'))
    const withPrior = scoreItem(
      milk({ averageDailyUse: undefined, events: two }),
      TODAY,
      { categoryDailyUsePriors: { 'Milk / dairy': 0.4 } },
    )
    assert.equal(withPrior.dailyUse, 0.4)
    assert.equal(withPrior.dailyUseSource, 'Prior')
    assert.equal(withPrior.dailyUseLabel, 'Estimated (prior)')
  })

  it('events from another item in the same category count toward learning', () => {
    const r = resolveDailyUse(
      { id: 'milk-9', category: 'Milk / dairy' },
      learnedEvents('other-1'),
    )
    assert.equal(r.value, 0.5)
    assert.equal(r.source, 'Learned')
  })

  it('discarded and adjusted events do not count toward the learned rate', () => {
    const mixed = [
      ...learnedEvents().slice(0, 2),
      { itemId: 'milk-1', category: 'Milk / dairy', eventType: 'discarded', quantity: 0.5, timestamp: '2026-10-24' },
      { itemId: 'milk-1', category: 'Milk / dairy', eventType: 'adjusted', quantity: 0.5, timestamp: '2026-10-24' },
    ]
    assert.equal(deriveLearnedDailyUse(mixed), null)
  })
})

describe('missing daily use (§6.3 step 4)', () => {
  it('known expiry but no daily-use value is insufficient-data', () => {
    const r = scoreItem(
      { id: 'y-1', category: 'Bread', quantityRemaining: 1, expiryDate: '2026-10-25' },
      TODAY,
    )
    assert.equal(r.status, 'insufficient-data')
    assert.deepEqual(r.missing, ['daily-use'])
  })
})

describe('expired and distant items', () => {
  it('an expired item scores U 100 with the full quantity as excess', () => {
    const r = scoreItem(milk({ expiryDate: '2026-10-20' }), TODAY)
    assert.equal(r.daysLeft, -4)
    assert.equal(r.urgency, 100)
    assert.equal(r.expectedUseBeforeExpiry, 0)
    assert.equal(r.excessQuantity, 2.0)
    assert.equal(r.riskScore, 100)
    assert.ok(r.reasonCodes.includes('EXPIRY_PAST_DUE'))
  })

  it('a distant expiry decays urgency to 0', () => {
    const r = scoreItem(milk({ expiryDate: '2026-11-23' }), TODAY)
    assert.equal(r.daysLeft, 30)
    assert.equal(r.urgency, 0)
    assert.equal(r.excessQuantity, 0)
    assert.equal(r.riskScore, 0)
    assert.equal(r.band, 'Low')
  })
})

describe('ordering (§6.1)', () => {
  it('equal scores order by earlier expiry, then larger excess, then id', () => {
    const x = scoreItem(milk({ id: 'x' }), TODAY) // 84, expiry 10-25, excess 1.5
    const y = scoreItem(milk({ id: 'y', quantityRemaining: 4.0, averageDailyUse: 1.0 }), TODAY) // 84, 10-25, excess 3.0
    const w = scoreItem(
      milk({ id: 'w', quantityRemaining: 1.0, expiryDate: '2026-10-26', averageDailyUse: 0.015 }),
      TODAY,
    ) // 84, 10-26, excess 0.97
    assert.equal(x.riskScore, 84)
    assert.equal(y.riskScore, 84)
    assert.equal(w.riskScore, 84)
    const sorted = [w, y, x].sort(compareItems)
    assert.deepEqual(sorted.map((s) => s.itemId), ['y', 'x', 'w'])
    const a = scoreItem(milk({ id: 'b' }), TODAY)
    const b = scoreItem(milk({ id: 'a' }), TODAY)
    assert.equal(compareItems(a, b) > 0, true)
  })
})

describe('priors (§6.3)', () => {
  it('v1.3 shelf-life priors are exact', () => {
    assert.equal(getShelfLifePrior('Bread'), 4)
    assert.equal(getShelfLifePrior('Milk / dairy'), 5)
    assert.equal(getShelfLifePrior('Dry staples (rice, pulses, flour)'), 180)
    assert.equal(getShelfLifePrior('No such category'), null)
  })
})
