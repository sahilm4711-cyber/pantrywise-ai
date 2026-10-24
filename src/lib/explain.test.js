import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeed } from './seed.js'
import { scoreAllItems } from './ranking.js'
import { explainItem, reasonText, templateExplanation } from './explain.js'

const TODAY = '2026-10-24'

function milkEntry() {
  const seed = buildSeed(TODAY)
  const { ranked } = scoreAllItems(seed.items, seed.events, TODAY)
  return ranked.find((entry) => entry.item.name === 'Milk')
}

test('reasonText renders every code family in plain language', () => {
  assert.equal(reasonText('EXPIRY_PAST_DUE'), 'Already expired')
  assert.equal(reasonText('EXPIRY_TODAY'), 'Expires today')
  assert.equal(reasonText('EXPIRY_1_DAY'), 'Expires in 1 day')
  assert.equal(reasonText('EXPIRY_5_DAY'), 'Expires in 5 days')
  assert.equal(reasonText('EXCESS_75_PCT'), '75% more than you will use before expiry')
  assert.equal(reasonText('EXCESS_0_PCT'), "You'll use it all before expiry")
  assert.equal(reasonText('USE_RATE_USER_ENTERED'), 'Daily use you entered')
  assert.equal(reasonText('USE_RATE_LEARNED'), 'Daily use learned from your history')
  assert.equal(reasonText('USE_RATE_PRIOR'), 'Daily use estimated from category')
  assert.equal(reasonText('EXPIRY_ESTIMATED'), 'Expiry estimated from category shelf life')
})

test('template explanation for Milk states the triggering facts', () => {
  const text = templateExplanation(milkEntry())
  assert.match(text, /Milk expires in 1 day/)
  assert.match(text, /2 L left/)
  assert.match(text, /1\.5 L \(75%\)/)
  assert.match(text, /Use it soon/)
})

test('template explanation for a zero-excess item says it will be finished', () => {
  const seed = buildSeed(TODAY)
  const { ranked } = scoreAllItems(seed.items, seed.events, TODAY)
  const cheese = ranked.find((entry) => entry.item.name === 'Cheese slices')
  assert.match(templateExplanation(cheese), /should finish it by expiry/)
  assert.match(templateExplanation(cheese), /No action needed yet/)
})

test('explainItem without an LLM returns the template', async () => {
  assert.equal(await explainItem(milkEntry()), templateExplanation(milkEntry()))
})

test('explainItem uses LLM text when it resolves, template on failure or timeout', async () => {
  const entry = milkEntry()
  assert.equal(
    await explainItem(entry, {
      llmExplain: async () => 'LLM says: drink the milk.',
    }),
    'LLM says: drink the milk.',
  )
  assert.equal(
    await explainItem(entry, {
      llmExplain: async () => {
        throw new Error('down')
      },
    }),
    templateExplanation(entry),
  )
  assert.equal(
    await explainItem(entry, {
      llmExplain: () => new Promise(() => {}),
      timeoutMs: 10,
    }),
    templateExplanation(entry),
  )
})
