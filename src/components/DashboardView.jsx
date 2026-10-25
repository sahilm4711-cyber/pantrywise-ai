import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { todayKey } from '../lib/dates.js'
import { reasonText, templateExplanation } from '../lib/explain.js'
import { computeMetrics } from '../lib/metrics.js'
import MealIdeasSection from './MealIdeasSection.jsx'
import { scoreAllItems } from '../lib/ranking.js'
import { recommendAll } from '../lib/recommend.js'

// Modules 3 + 5 — Use Soon list + explanations (FR-02, FR-03, FR-10) and
// dashboard metrics (FR-06). Scores, bands, and confidence come from the
// Module 1 engine; recommendations from Module 4; this view only renders
// them. Recorded totals come from events, projections from scores — the
// two are kept separate (FR-06).

function expiryText(entry) {
  if (entry.expiryConfidence === 'Known') return `Expires ${entry.expiryDate}`
  if (entry.expiryConfidence === 'Estimated (prior)') {
    return `Expires ${entry.expiryDate} (estimated)`
  }
  return 'No date'
}

function bandClass(band) {
  return `badge badge-${band.toLowerCase()}`
}

// Styling pass — the score is the hero: a large numeral plus a
// band-colored urgency bar, instead of the small badge the ranked rows
// still use. Presentational only; scores and bands are unchanged.
function UseSoonCard({ entry }) {
  const { item } = entry
  return (
    <li className="item-row use-soon-card">
      <div className="use-soon-body">
        <div className="item-name">{item.name}</div>
        <div className="item-meta">
          {item.quantityRemaining} {item.unit} · {expiryText(entry)} ·{' '}
          {entry.confidence}
        </div>
        <div className="chip-row">
          {entry.reasonCodes.map((code) => (
            <span key={code} className="chip">
              {reasonText(code)}
            </span>
          ))}
        </div>
        <p className="explanation">{templateExplanation(entry)}</p>
      </div>
      <div className="score-hero">
        <span className="score-number">{entry.riskScore}</span>
        <span className={`score-band score-${entry.band.toLowerCase()}`}>
          {entry.band}
        </span>
      </div>
      <div className="urgency-bar">
        <span
          className={`urgency-fill urgency-${entry.band.toLowerCase()}`}
          style={{ width: `${entry.riskScore}%` }}
        />
      </div>
    </li>
  )
}

function missingText(missing) {
  return missing
    .map((m) => (m === 'expiry' ? 'expiry date' : 'daily use'))
    .join(' and ')
}

export default function DashboardView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const today = todayKey()
  const result = useMemo(
    () => scoreAllItems(state.items, state.events, today),
    [state, today],
  )
  const recommendations = useMemo(
    () => recommendAll(state.shoppingList, state.items, state.events, today),
    [state, today],
  )
  const metrics = useMemo(
    () =>
      computeMetrics({
        items: state.items,
        events: state.events,
        ranked: result.ranked,
        recommendations,
      }),
    [state, result, recommendations],
  )

  if (state.items.length === 0) {
    return (
      <section className="card">
        <h2>Use Soon</h2>
        <p className="hint">
          No items yet. Add items on the Inventory tab, or load the demo
          data there, and this list will rank them.
        </p>
      </section>
    )
  }

  return (
    <div>
      <section className="card">
        <h2>At a glance</h2>
        <div className="metrics">
          <div className="metric-card">
            <div className="metric-value">{metrics.activeCount}</div>
            <div className="metric-label">Active items</div>
          </div>
          <div className="metric-card metric-accent">
            <div className="metric-value">{metrics.attentionCount}</div>
            <div className="metric-label">Needing attention (score ≥ 40)</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{metrics.duplicateAlertCount}</div>
            <div className="metric-label">Duplicate alerts</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{metrics.consumedTotal}</div>
            <div className="metric-label">
              Recorded consumed ({metrics.consumedEventCount} records)
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{metrics.discardedTotal}</div>
            <div className="metric-label">
              Recorded discarded ({metrics.discardedEventCount} records)
            </div>
          </div>
        </div>
        <p className="hint">
          Recorded totals come from logged events; Use Soon and ranked
          lists are projections from scores. The two are kept separate
          (FR-06).
        </p>
      </section>

      <section className="card">
        <h2>Top 3 Use Soon</h2>
        {result.useSoon.length === 0 ? (
          <p className="hint">Nothing urgent right now.</p>
        ) : (
          <ul className="item-list">
            {result.useSoon.slice(0, 3).map((entry) => (
              <li
                key={entry.itemId}
                className={`item-row top3-row top3-${entry.band.toLowerCase()}`}
              >
                <div>
                  <div className="item-name">
                    {entry.item.name}
                    <span className={bandClass(entry.band)}>
                      {entry.band} · {entry.riskScore}
                    </span>
                  </div>
                  <div className="item-meta">
                    {entry.item.quantityRemaining} {entry.item.unit} ·{' '}
                    {expiryText(entry)} · {entry.confidence}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {metrics.duplicateAlerts.length > 0 && (
        <section className="card">
          <h2>Duplicate alerts ({metrics.duplicateAlertCount})</h2>
          <p className="hint">
            Shopping-list items that duplicate something already in
            inventory.
          </p>
          <ul className="item-list">
            {metrics.duplicateAlerts.map(({ listItem, recommendation }) => (
              <li key={listItem.id} className="item-row">
                <div>
                  <div className="item-name">
                    {listItem.name} — {recommendation.label}
                  </div>
                  <div className="item-meta">
                    Matches {recommendation.matchedItem.name} (
                    {recommendation.matchedItem.quantityRemaining}{' '}
                    {recommendation.matchedItem.unit} in inventory)
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Use Soon ({result.useSoon.length})</h2>
        {result.useSoon.length === 0 ? (
          <p className="hint">
            Nothing urgent — no item scores 70 or above right now.
          </p>
        ) : (
          <ul className="item-list">
            {result.useSoon.map((entry) => (
              <UseSoonCard key={entry.itemId} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>All items, ranked ({result.ranked.length})</h2>
        <ul className="item-list">
          {result.ranked.map((entry) => (
            <li key={entry.itemId} className="item-row">
              <div>
                <div className="item-name">
                  {entry.item.name}
                  <span className={bandClass(entry.band)}>
                    {entry.band} · {entry.riskScore}
                  </span>
                </div>
                <div className="item-meta">
                  {entry.item.quantityRemaining} {entry.item.unit} ·{' '}
                  {expiryText(entry)} · {entry.confidence}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {result.needsInfo.length > 0 && (
        <section className="card">
          <h2>Needs information ({result.needsInfo.length})</h2>
          <p className="hint">
            These items cannot be scored yet — add the missing detail on the
            Inventory tab.
          </p>
          <ul className="item-list">
            {result.needsInfo.map((entry) => (
              <li key={entry.itemId} className="item-row">
                <div>
                  <div className="item-name">{entry.item.name}</div>
                  <div className="item-meta">
                    Insufficient · Needs: {missingText(entry.missing)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* FR-17 (P2): hidden while no meal-ideas endpoint is configured. */}
      <MealIdeasSection items={result.useSoon.slice(0, 3)} endpoint={null} />
    </div>
  )
}
