import { useMemo } from 'react'
import { useSyncExternalStore } from 'react'
import { todayKey } from '../lib/dates.js'
import { reasonText, templateExplanation } from '../lib/explain.js'
import { scoreAllItems } from '../lib/ranking.js'

// Module 3 — Use Soon list + explanations (FR-02, FR-03, FR-10).
// Scores, bands, and confidence come from the Module 1 engine; this view
// only renders them. Shopping recommendations (FR-05) stay in Module 4 and
// dashboard metrics (FR-06) in Module 5.

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

function UseSoonCard({ entry }) {
  const { item } = entry
  return (
    <li className="item-row">
      <div>
        <div className="item-name">
          {item.name}
          <span className={bandClass(entry.band)}>
            {entry.band} · {entry.riskScore}
          </span>
        </div>
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
                    Needs: {missingText(entry.missing)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
