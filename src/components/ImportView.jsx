// Import tab — PRD v1.3 FR-14 (receipt import) and FR-16 (retailer
// integration), both P2. Neither saves anything before the user
// confirms in review; uncertain fields are flagged, not guessed.

import { useState, useSyncExternalStore } from 'react'
import { CATEGORIES } from '../lib/store.js'
import { todayKey, isValidDateKey } from '../lib/dates.js'
import { parseReceipt, SAMPLE_RECEIPT } from '../lib/receipt.js'
import {
  dedupeRetailerEntries,
  parseRetailerHistory,
  SAMPLE_HISTORY,
} from '../lib/retailer.js'

function uncertainLabel(flags) {
  if (flags.length === 0) return ''
  return `Check: ${flags.join(', ')}`
}

export default function ImportView({ store }) {
  const state = useSyncExternalStore(store.subscribe, store.getState)
  const [receiptText, setReceiptText] = useState('')
  const [receiptRows, setReceiptRows] = useState(null)
  const [receiptSkipped, setReceiptSkipped] = useState(0)
  const [retailerName, setRetailerName] = useState('')
  const [historyText, setHistoryText] = useState('')
  const [retailerRows, setRetailerRows] = useState(null)
  const [retailerErrors, setRetailerErrors] = useState([])
  const [notice, setNotice] = useState('')

  function handleReceiptParse() {
    const { lines, skipped } = parseReceipt(receiptText)
    setReceiptRows(
      lines.map((l, i) => ({
        key: `r${i}`,
        name: l.name,
        quantity: l.quantity === null ? '' : String(l.quantity),
        unit: l.unit ?? '',
        category: l.category ?? '',
        uncertain: l.uncertain,
      })),
    )
    setReceiptSkipped(skipped)
    setNotice(
      lines.length === 0
        ? 'No items found on that receipt.'
        : `Parsed ${lines.length} items.`,
    )
  }

  function handleReceiptConfirm() {
    let added = 0
    let skippedRows = 0
    for (const row of receiptRows ?? []) {
      const quantity = Number(row.quantity)
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        row.unit.trim() === '' ||
        row.category === ''
      ) {
        skippedRows += 1
        continue
      }
      const res = store.addItem({
        name: row.name,
        category: row.category,
        quantity,
        unit: row.unit.trim(),
        purchaseDate: todayKey(),
        expiryDate: null,
        averageDailyUse: null,
        source: 'receipt',
        externalId: null,
      })
      if (res.ok) added += 1
      else skippedRows += 1
    }
    setReceiptRows(null)
    setNotice(
      `Added ${added} items from the receipt.` +
        (skippedRows > 0 ? ` ${skippedRows} lines skipped (incomplete).` : ''),
    )
  }

  function handleHistoryParse() {
    const { entries, errors } = parseRetailerHistory(historyText)
    setRetailerErrors(errors)
    if (entries.length === 0) {
      setRetailerRows(null)
      setNotice('No usable lines in that history.')
      return
    }
    const { toAdd, skipped } = dedupeRetailerEntries(entries, state.items)
    setRetailerRows({
      toAdd: toAdd.map((e, i) => ({
        key: `h${i}`,
        ...e,
        category: e.category ?? '',
      })),
      skipped,
    })
    setNotice(
      `Parsed ${entries.length} lines: ${toAdd.length} new, ${skipped.length} already imported.`,
    )
  }

  function handleHistoryConfirm() {
    const source = retailerName.trim() === '' ? 'retailer' : retailerName.trim()
    let added = 0
    let skippedRows = 0
    for (const row of retailerRows?.toAdd ?? []) {
      if (row.category === '') {
        skippedRows += 1
        continue
      }
      const res = store.addItem({
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        unit: row.unit,
        purchaseDate: isValidDateKey(row.purchaseDate ?? '')
          ? row.purchaseDate
          : todayKey(),
        expiryDate: null,
        averageDailyUse: null,
        source,
        externalId: row.externalId,
      })
      if (res.ok) added += 1
      else skippedRows += 1
    }
    setRetailerRows(null)
    setNotice(
      `Added ${added} items from ${source}.` +
        (skippedRows > 0 ? ` ${skippedRows} lines skipped (incomplete).` : ''),
    )
  }

  return (
    <div>
      <section className="card">
        <h2>Import from receipt (FR-14)</h2>
        <p className="hint">
          Paste a receipt, or load the sample. Lines the parser cannot
          resolve are flagged — fix them in review, then confirm. Nothing
          is saved before you confirm.
        </p>
        <textarea
          rows={8}
          value={receiptText}
          onChange={(e) => setReceiptText(e.target.value)}
          placeholder={'Milk 1 L\nRice 5 kg'}
        />
        <div className="form-row">
          <button
            type="button"
            className="btn"
            onClick={() => setReceiptText(SAMPLE_RECEIPT)}
          >
            Use sample receipt
          </button>
          <button type="button" className="btn btn-primary" onClick={handleReceiptParse}>
            Parse receipt
          </button>
        </div>
        {receiptRows && (
          <div>
            {receiptSkipped > 0 && (
              <p className="hint">
                Skipped {receiptSkipped} lines (headers, totals).
              </p>
            )}
            <table className="insights-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Category</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receiptRows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.name}
                      {row.uncertain.length > 0 && (
                        <div className="hint">
                          {uncertainLabel(row.uncertain)}
                        </div>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={row.quantity}
                        onChange={(e) =>
                          setReceiptRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, quantity: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) =>
                          setReceiptRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, unit: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={row.category}
                        onChange={(e) =>
                          setReceiptRows((rows) =>
                            rows.map((r) =>
                              r.key === row.key
                                ? { ...r, category: e.target.value }
                                : r,
                            ),
                          )
                        }
                      >
                        <option value="">Choose…</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() =>
                          setReceiptRows((rows) =>
                            rows.filter((r) => r.key !== row.key),
                          )
                        }
                      >
                        Drop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReceiptConfirm}
              >
                Confirm and add to inventory
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Import retailer history (FR-16)</h2>
        <p className="hint">
          Paste a retailer purchase history as a JSON array. Lines whose
          externalId is already in inventory are skipped, so re-importing
          never duplicates stock.
        </p>
        <div className="form-row">
          <input
            type="text"
            value={retailerName}
            onChange={(e) => setRetailerName(e.target.value)}
            placeholder="Retailer name (e.g. Fresh Mart)"
          />
        </div>
        <textarea
          rows={8}
          value={historyText}
          onChange={(e) => setHistoryText(e.target.value)}
          placeholder='[{"name": "Milk", "quantity": 1, "unit": "L"}]'
        />
        <div className="form-row">
          <button
            type="button"
            className="btn"
            onClick={() => setHistoryText(SAMPLE_HISTORY)}
          >
            Use sample history
          </button>
          <button type="button" className="btn btn-primary" onClick={handleHistoryParse}>
            Parse history
          </button>
        </div>
        {retailerErrors.length > 0 && (
          <div>
            {retailerErrors.map((err, i) => (
              <p key={i} className="field-error">
                {err}
              </p>
            ))}
          </div>
        )}
        {retailerRows && (
          <div>
            {retailerRows.skipped.length > 0 && (
              <p className="hint">
                Already imported, skipped:{' '}
                {retailerRows.skipped.map((s) => s.name).join(', ')}.
              </p>
            )}
            <table className="insights-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {retailerRows.toAdd.map((row) => (
                  <tr key={row.key}>
                    <td>{row.name}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unit}</td>
                    <td>
                      <select
                        value={row.category}
                        onChange={(e) =>
                          setRetailerRows((prev) => ({
                            ...prev,
                            toAdd: prev.toAdd.map((r) =>
                              r.key === row.key
                                ? { ...r, category: e.target.value }
                                : r,
                            ),
                          }))
                        }
                      >
                        <option value="">Choose…</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleHistoryConfirm}
              >
                Confirm and add to inventory
              </button>
            </div>
          </div>
        )}
      </section>
      {notice && <p className="hint">{notice}</p>}
    </div>
  )
}
