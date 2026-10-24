import { useMemo, useState } from 'react'
import { useSyncExternalStore } from 'react'
import { todayKey } from '../lib/dates.js'
import {
  recommendAll,
  recommendationReasonText,
} from '../lib/recommend.js'

// Module 4 — shopping list + recommendations (FR-04, FR-05).
// Recommendations recompute from store state on every render, so editing
// inventory quantities updates them immediately with no reload.

const TYPE_BADGE = {
  'use-soon': 'rec-use-soon',
  skip: 'rec-skip',
  'buy-less': 'rec-buy-less',
  keep: 'rec-keep',
  review: 'rec-review',
}

const EMPTY_FORM = { name: '', quantityWanted: '', unit: '' }

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

function RecommendationCard({ listItem, recommendation }) {
  const { facts, matchedItem } = recommendation
  return (
    <div>
      <div>
        <div className="item-name">
          {listItem.name} — {listItem.quantityWanted} {listItem.unit}
          <span className={`badge ${TYPE_BADGE[recommendation.type]}`}>
            {recommendation.label}
          </span>
        </div>
        <div className="item-meta">
          {matchedItem
            ? `Matches ${matchedItem.name} (${matchedItem.quantityRemaining} ${matchedItem.unit} in inventory)`
            : 'No match in inventory'}
          {facts.similarity !== undefined &&
            ` · similarity ${Math.round(facts.similarity * 100)}%`}
          {facts.stockCover !== undefined &&
            ` · stock cover ${facts.stockCover} days`}
          {facts.riskScore !== undefined &&
            ` · inventory risk score ${facts.riskScore}`}
        </div>
        {recommendation.type === 'buy-less' && (
          <div className="item-meta">
            Suggested quantity: {facts.suggestedQuantity}{' '}
            {facts.suggestedUnit}
          </div>
        )}
        <div className="chip-row">
          {recommendation.reasonCodes.map((code) => (
            <span key={code} className="chip">
              {recommendationReasonText(code)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ShoppingView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  const today = todayKey()
  const recommendations = useMemo(
    () =>
      recommendAll(state.shoppingList, state.items, state.events, today),
    [state, today],
  )

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setNotice('')
    const result = editingId
      ? store.updateShoppingItem(editingId, form)
      : store.addShoppingItem(form)
    if (!result.ok) {
      setErrors(result.errors ?? {})
      return
    }
    setErrors({})
    setForm(EMPTY_FORM)
    setEditingId(null)
    setNotice(editingId ? 'List item updated.' : 'List item added.')
  }

  function startEdit(item) {
    setForm({
      name: item.name,
      quantityWanted: String(item.quantityWanted),
      unit: item.unit,
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
    if (window.confirm(`Remove ${item.name} from the shopping list?`)) {
      store.deleteShoppingItem(item.id)
      if (editingId === item.id) cancelEdit()
    }
  }

  return (
    <div>
      <section className="card">
        <h2>{editingId ? 'Edit list item' : 'Add to shopping list'}</h2>
        <form className="form" onSubmit={handleSubmit}>
          <Field label="Name" error={errors.name}>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Milk"
            />
          </Field>
          <Field label="Quantity wanted" error={errors.quantityWanted}>
            <input
              type="number"
              step="any"
              min="0"
              value={form.quantityWanted}
              onChange={(e) => setField('quantityWanted', e.target.value)}
              placeholder="e.g. 2"
            />
          </Field>
          <Field label="Unit" error={errors.unit}>
            <input
              type="text"
              value={form.unit}
              onChange={(e) => setField('unit', e.target.value)}
              placeholder="e.g. L"
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
        <h2>Recommendations ({recommendations.length})</h2>
        {notice && <p className="hint">{notice}</p>}
        {recommendations.length === 0 ? (
          <p className="hint">
            No items on the list yet. Add one above, or load the demo data
            on the Inventory tab.
          </p>
        ) : (
          <ul className="item-list">
            {recommendations.map(({ listItem, recommendation }) => (
              <li key={listItem.id} className="item-row">
                <div style={{ flex: 1 }}>
                  <RecommendationCard
                    listItem={listItem}
                    recommendation={recommendation}
                  />
                </div>
                <div className="item-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => startEdit(listItem)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(listItem)}
                  >
                    Remove
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
