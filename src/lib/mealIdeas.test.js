import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMealIdeasPayload,
  fetchMealIdeas,
  selectMealIdeaItems,
} from './mealIdeas.js'

function entry(name, band, remaining = 1) {
  return {
    item: { name, quantityRemaining: remaining, unit: 'L' },
    band,
    riskScore: 84,
    itemId: 'id-' + name,
  }
}

test('top-3 High items only, in ranked order', () => {
  const selected = selectMealIdeaItems([
    entry('Dal', 'High'),
    entry('Spinach', 'High'),
    entry('Methi', 'High'),
    entry('Milk', 'High'),
    entry('Rice', 'Medium'),
  ])
  assert.deepEqual(
    selected.map((e) => e.item.name),
    ['Dal', 'Spinach', 'Methi'],
  )
})

test('payload carries names and quantities only — no scores, no ids', () => {
  const payload = buildMealIdeasPayload([entry('Milk', 'High', 2)])
  assert.deepEqual(payload, {
    items: [{ name: 'Milk', quantity: 2, unit: 'L' }],
  })
})

test('no endpoint means no meal ideas (control hidden)', async () => {
  const result = await fetchMealIdeas({ items: [] }, { endpoint: null })
  assert.equal(result, null)
})

test('a responding endpoint wins; a timeout yields nothing', async () => {
  const fakeFetch = async () => ({
    json: async () => ({ mealIdeasText: 'Make a dal tadka.' }),
  })
  const ok = await fetchMealIdeas(
    { items: [] },
    { endpoint: 'https://example.test/api/meal-ideas', fetchFn: fakeFetch },
  )
  assert.equal(ok, 'Make a dal tadka.')
  const slow = await fetchMealIdeas(
    { items: [] },
    {
      endpoint: 'https://example.test/api/meal-ideas',
      timeoutMs: 10,
      fetchFn: () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ json: async () => ({ mealIdeasText: 'Late.' }) }),
            100,
          )
        }),
    },
  )
  assert.equal(slow, null)
})
