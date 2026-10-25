// Use-it-up meal ideas — PRD v1.3 FR-17 (P2).
// Same shape as the /api/explain hook (Module 3): an optional LLM
// endpoint, a 3 s timeout, and nothing when it is disabled. The payload
// carries item names and quantities ONLY — never scores, never ids —
// and the output never affects ranking. With the endpoint disabled the
// control is hidden and nothing else changes, so this module ships the
// hook, the payload builder, and the hidden control; no LLM is
// connected, so no meal ideas appear.

export function selectMealIdeaItems(useSoonEntries) {
  return useSoonEntries.filter((e) => e.band === 'High').slice(0, 3)
}

export function buildMealIdeasPayload(items) {
  return {
    items: items.map((entry) => ({
      name: entry.item.name,
      quantity: entry.item.quantityRemaining,
      unit: entry.item.unit,
    })),
  }
}

export async function fetchMealIdeas(payload, options = {}) {
  const { endpoint = null, timeoutMs = 3000, fetchFn = fetch } = options
  if (!endpoint) return null
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), timeoutMs)
  })
  const request = (async () => {
    try {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'meal-ideas', items: payload.items }),
      })
      const data = await res.json()
      if (data && typeof data.mealIdeasText === 'string' && data.mealIdeasText.trim() !== '') {
        return data.mealIdeasText
      }
      return null
    } catch {
      return null
    }
  })()
  return Promise.race([request, timeout])
}
