// Use-it-up meal ideas — PRD v1.3 FR-17 (P2).
// The control is hidden while no endpoint is configured, exactly as
// the PRD specifies: with the endpoint disabled, nothing else changes.
// The app passes endpoint={null} today, so this renders nothing — the
// hook, payload builder, and timeout are implemented and tested, and
// connecting an endpoint later is a one-line change in DashboardView.

import { useEffect, useState } from 'react'
import { buildMealIdeasPayload, fetchMealIdeas } from '../lib/mealIdeas.js'

export default function MealIdeasSection({ items, endpoint }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    if (!endpoint || items.length === 0) return
    let cancelled = false
    fetchMealIdeas(buildMealIdeasPayload(items), { endpoint }).then((t) => {
      if (!cancelled) setText(t)
    })
    return () => {
      cancelled = true
    }
  }, [endpoint, items])
  if (!endpoint) return null
  if (items.length === 0) return null
  return (
    <section className="card">
      <h2>Use-it-up ideas</h2>
      {text ? (
        <p>{text}</p>
      ) : (
        <p className="hint">
          Ideas for your top use-soon items will appear here.
        </p>
      )}
    </section>
  )
}
