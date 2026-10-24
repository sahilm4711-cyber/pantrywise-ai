import { useState, useSyncExternalStore } from 'react'
import { resolveExpiry } from '../lib/riskEngine.js'
import { CATEGORIES, CATEGORY_PRESETS } from '../lib/store.js'

// Module 2 — inventory UI only. No scores, matches, or recommendations here;
// those arrive with Modules 3 and 4. Expiry labels reuse the Module 1
// resolver so an estimate is never shown as a known date (FR-08).

const STATUS_LABELS = {
  active: 'Active',
  'partially consumed': 'Partially used',
  consumed: 'Finished',
  discarded: 'Discarded',
}

const EMPTY_FORM = {
  name: '',
  category: '',
  quantity: '',
  unit: '',
  purchaseDate: '',
  expiryDate: '',
  averageDailyUse: '',
}

function expiryText(item) {
  const resolved = resolveExpiry(item)
  if (!resolved) return 'No date'
  return resolved.confidence === 'Known'
    ? `Expires ${resolved.expiryDate}`
    : `Expires ${resolved.expiryDate} (estimated)`
}

// Module 5 — per-item consumption logging. This completes the Module 2
// event loop in the UI: logging Used/Discarded here is what moves the
// FR-06 dashboard metrics (and feeds FR-09 learning for consumed events).
// The row remounts on quantity change (key below), so the input resets to
// the new remaining amount after each log.
function LogControl({ store, item }) {
  const [qty, setQty] = useState(String(item.quantityRemaining))
  const [error, setError] = useState('')
  function log(eventType) {
    const result = store.logEvent({
      itemId: item.id,
      eventType,
      quantity: Number(qty),
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError('')
  }
  return (
    <div className="log-row">
      <input
        type="number"
        step="any"
        min="0"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        aria-label={`Quantity to log for ${item.name}`}
      />
      <span className="hint">{item.unit}</span>
      <button type="button" className="btn" onClick={() => log('consumed')}>
        Used
      </button>
      <button type="button" className="btn" onClick={() => log('discarded')}>
        Discarded
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div className="field">
      <label>
        {label}
        {children}
      </label>
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

export default function InventoryView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  function setField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'category') {
        // Quick-add preset (FR-01): the category prefills the unit.
        next.unit = CATEGORY_PRESETS[value] ?? ''
      }
      return next
    })
  }

  function estimatedHint() {
    if (!form.purchaseDate || !form.category || form.expiryDate) return ''
    const resolved = resolveExpiry({
      purchaseDate: form.purchaseDate,
      category: form.category,
    })
    return resolved ? `Estimated expiry: ${resolved.expiryDate} (prior)` : ''
  }

  function handleSubmit(event) {
    event.preventDefault()
    setNotice('')
    const result = editingId
      ? store.updateItem(editingId, {
          ...form,
          quantityRemaining: form.quantity,
        })
      : store.addItem(form)
    if (!result.ok) {
      setErrors(result.errors ?? {})
      return
    }
    setErrors({})
    setForm(EMPTY_FORM)
    setEditingId(null)
    setNotice(editingId ? 'Item updated.' : 'Item added.')
  }

  function startEdit(item) {
    setForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantityRemaining),
      unit: item.unit,
      purchaseDate: item.purchaseDate ?? '',
      expiryDate: item.expiryDate ?? '',
      averageDailyUse:
        item.averageDailyUse == null ? '' : String(item.averageDailyUse),
    })
    setEditingId(item.id)
    setErrors({})
    setNotice('')
  }

  function cancelEdit() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setErrors({})
  }

  function handleDelete(item) {
    if (window.confirm(`Delete ${item.name}?`)) {
      store.deleteItem(item.id)
      if (editingId === item.id) cancelEdit()
    }
  }

  function handleSeed() {
    if (
      window.confirm(
        'Replace the current inventory with the 40-item demo dataset?',
      )
    ) {
      store.seedDemo()
      setNotice('Demo data loaded: 40 items, 5 shopping-list items.')
    }
  }

  function handleClear() {
    if (window.confirm('Delete all items, events, and shopping-list items?')) {
      store.clearAll()
      cancelEdit()
      setNotice('Inventory cleared.')
    }
  }

  return (
    <div>
      <section className="card">
        <h2>{editingId ? 'Edit item' : 'Add item'}</h2>
        <form className="form" onSubmit={handleSubmit}>
          <Field label="Name" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Milk"
            />
          </Field>
          <Field label="Category" error={errors.category}>
            <select
              value={form.category}
              onChange={(e) => setField('category', e.target.value)}
            >
              <option value="">Choose a category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity" error={errors.quantity}>
            <input
              type="number"
              step="any"
              min="0"
              value={form.quantity}
              onChange={(e) => setField('quantity', e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>
          <Field label="Unit" error={errors.unit}>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setField('unit', e.target.value)}
              placeholder="Prefilled by category"
            />
          </Field>
          <Field label="Purchase date" error={errors.purchaseDate}>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setField('purchaseDate', e.target.value)}
            />
          </Field>
          <Field label="Expiry date (optional)" error={errors.expiryDate}>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setField('expiryDate', e.target.value)}
            />
          </Field>
          {estimatedHint() && <p className="hint">{estimatedHint()}</p>}
          <Field label="Daily use (optional)" error={errors.averageDailyUse}>
            <input
              type="number"
              step="any"
              min="0"
              value={form.averageDailyUse}
              onChange={(e) => setField('averageDailyUse', e.target.value)}
              placeholder="e.g. 0.5 per day"
            />
          </Field>
          <div className="form-row">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Save changes' : 'Add item'}
            </button>
            {editingId && (
              <button type="button" className="btn" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Inventory ({state.items.length} items)</h2>
        <div className="form-row">
          <button type="button" className="btn" onClick={handleSeed}>
            Load demo data
          </button>
          <button type="button" className="btn btn-danger" onClick={handleClear}>
            Clear all
          </button>
        </div>
        {notice && <p className="hint">{notice}</p>}
        {state.items.length === 0 ? (
          <p className="hint">
            No items yet. Add one above, or load the demo data.
          </p>
        ) : (
          <ul className="item-list">
            {state.items.map((item) => (
              <li key={item.id} className="item-row">
                <div>
                  <div className="item-name">{item.name}</div>
                  <div className="item-meta">
                    {item.quantityRemaining} {item.unit} · {item.category} ·{' '}
                    {expiryText(item)} ·{' '}
                    {STATUS_LABELS[item.status] ?? item.status}
                  </div>
                  {item.quantityRemaining > 0 && (
                    <LogControl
                      key={`${item.id}-${item.quantityRemaining}`}
                      store={store}
                      item={item}
                    />
                  )}
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => store.addAgain(item.id)}
                  >
                    Add again
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(item)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
