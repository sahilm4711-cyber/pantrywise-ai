import { useState } from 'react'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', module: 'Module 5' },
  { id: 'inventory', label: 'Inventory', module: 'Module 2' },
  { id: 'shopping', label: 'Shopping List', module: 'Module 4' },
]

// Module 0 — project shell only. Views below are placeholders until their
// module lands; nothing here pretends to score, match, or recommend yet.
// Source of truth: PRD v1.3 (VisionX build copy, submitted for Round 1).
export default function App() {
  const [view, setView] = useState('dashboard')
  const current = VIEWS.find((v) => v.id === view)

  return (
    <div className="shell">
      <header className="header">
        <h1>PantryWise AI</h1>
        <p className="tagline">
          Household grocery intelligence — what to use soon, and what not to
          buy twice.
        </p>
        <nav className="nav" aria-label="Main">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === view ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main">
        <section className="card">
          <h2>{current.label}</h2>
          <p>
            Placeholder for {current.module}. This view arrives with its
            module; until then it renders no inventory, scores, or
            recommendations.
          </p>
        </section>

        <section className="card">
          <h2>Module 0 — foundation status</h2>
          <ul>
            <li>React + Vite app runs (this shell)</li>
            <li>Shared repository with a runnable main branch</li>
            <li>Next: Module 1 — risk-scoring engine (pure JavaScript + tests)</li>
          </ul>
        </section>
      </main>
    </div>
  )
}
