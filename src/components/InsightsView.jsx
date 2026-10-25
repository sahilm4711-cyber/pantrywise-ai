// Historical insights — PRD v1.3 FR-11 (P1).
// Below 5 recorded events the view is an empty state, not an empty
// chart: trends need a minimum of history to mean anything.

import { useState, useSyncExternalStore } from 'react'
import {
  computeInsights,
  computeMemberStats,
  TREND_THRESHOLD,
} from '../lib/insights.js'

function fmt(value) {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

export default function InsightsView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const insights = computeInsights(state.events)
  const memberStats = computeMemberStats(state.events, state.members)
  const [memberName, setMemberName] = useState('')
  const [memberNotice, setMemberNotice] = useState('')

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

      <section className="card">
        <h2>Household (FR-15)</h2>
        <p className="hint">
          Members share this one on-device inventory. Events logged
          while a member is active are attributed to them below. There
          is no cross-device sync — the PRD leaves multi-household sync
          out of scope.
        </p>
        <div className="form-row">
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            placeholder="Member name"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const res = store.addMember(memberName)
              if (res.ok) {
                setMemberName('')
                setMemberNotice(`Added ${res.member.name}.`)
              } else {
                setMemberNotice(res.error)
              }
            }}
          >
            Add member
          </button>
          <select
            value={state.activeMemberId ?? ''}
            onChange={(e) =>
              store.setActiveMember(e.target.value === '' ? null : e.target.value)
            }
          >
            <option value="">Nobody (shared log)</option>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {memberNotice && <p className="hint">{memberNotice}</p>}
        {memberStats.length > 0 && (
          <table className="insights-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Events</th>
                <th>Used</th>
                <th>Discarded</th>
              </tr>
            </thead>
            <tbody>
              {memberStats.map((row) => (
                <tr key={row.memberId ?? row.memberName}>
                  <td>{row.memberName}</td>
                  <td>{row.events}</td>
                  <td>{fmt(row.consumed)}</td>
                  <td>{fmt(row.discarded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
