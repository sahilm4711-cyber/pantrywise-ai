// Historical insights — PRD v1.3 FR-11 (P1).
// Below 5 recorded events the view is an empty state, not an empty
// chart: trends need a minimum of history to mean anything.

import { useSyncExternalStore } from 'react'
import { computeInsights, TREND_THRESHOLD } from '../lib/insights.js'

function fmt(value) {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export default function InsightsView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const insights = computeInsights(state.events)

  return (
    <div>
      <section className="card">
        <h2>History</h2>
        {insights.hasTrends ? (
          <div>
            <div className="metrics">
              <div className="metric">
                <div className="metric-value">{fmt(insights.consumedTotal)}</div>
                <div className="metric-label">
                  Used ({insights.consumedCount} events)
                </div>
              </div>
              <div className="metric">
                <div className="metric-value">
                  {fmt(insights.discardedTotal)}
                </div>
                <div className="metric-label">
                  Discarded ({insights.discardedCount} events)
                </div>
              </div>
              <div className="metric">
                <div className="metric-value">{insights.eventCount}</div>
                <div className="metric-label">Events recorded</div>
              </div>
            </div>
            <table className="insights-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Used</th>
                  <th>Discarded</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {insights.byCategory.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    <td>{fmt(row.consumed)}</td>
                    <td>{fmt(row.discarded)}</td>
                    <td>{row.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hint">
              Totals come from recorded Used / Discarded events only — they
              are history, not score projections.
            </p>
          </div>
        ) : (
          <p className="hint">
            No trends yet. Log at least {TREND_THRESHOLD} usage events
            (Used or Discarded on the Inventory tab) and this view fills
            in — {insights.eventCount} recorded so far.
          </p>
        )}
      </section>
    </div>
  )
}
