import { useState } from 'react'
import DashboardView from './components/DashboardView.jsx'
import InventoryView from './components/InventoryView.jsx'
import ShoppingView from './components/ShoppingView.jsx'
import { store } from './lib/storeInstance.js'

const VIEWS = [
  { id: 'dashboard', label: 'Dashboard', module: 'Module 5' },
  { id: 'inventory', label: 'Inventory', module: 'Module 2' },
  { id: 'shopping', label: 'Shopping List', module: 'Module 4' },
]

// Source of truth: PRD v1.3 (VisionX build copy, submitted for Round 1).
// Each view renders only what its module has delivered; placeholders stay
// honest about what is not built yet.
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
        {view === 'inventory' ? (
          <InventoryView store={store} />
        ) : view === 'dashboard' ? (
          <DashboardView store={store} />
        ) : view === 'shopping' ? (
          <ShoppingView store={store} />
        ) : (
          <section className="card">
            <h2>{current.label}</h2>
            <p>
              Placeholder for {current.module}. This view arrives with its
              module; until then it renders no inventory, scores, or
              recommendations.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
