// Inventory store — PRD v1.3 FR-01 (CRUD + validation + persistence),
// FR-07 (demo seed), §7 data model (items, events, shopping list).
//
// Pure logic plus a localStorage-compatible storage adapter: the browser
// app persists under STORAGE_KEY; tests inject memory storage. Every
// mutation saves immediately, so a refresh never loses an edit (Module 2
// test: add → refresh → still there).
//
// Design notes (module decisions, flagged not hidden):
// - quantityRemaining is stored as the source of truth; InventoryEvent rows
//   are the audit log for learning (FR-09) and metrics (FR-06), not the
//   recompute source. Deleting an item keeps its events (household history).
// - "Add again" copies the source item but clears expiryDate: a fresh
//   purchase gets a fresh prior estimate, not the old item's date.
// - Purchase date is optional at entry even though FR-01 lists it as a
//   field: §6.6 scenario 4 proves dateless items are legitimate in this
//   system, and the engine handles them as insufficient-data.
// - Corrupt stored JSON degrades to an empty state, never a crash (NFR);
//   wasCorrupted() reports it so a later module can offer restore (FR-12).

import { formatDay, isDateLike, toDayMs, todayKey } from './dates.js'
import { buildSeed } from './seed.js'
import { validateItemInput } from './validate.js'

export const STORAGE_KEY = 'pantrywise-ai-v1'
export const SCHEMA_VERSION = 1

// Quick-add presets (FR-01): choosing a category prefills the unit.
// Only Milk / dairy → litres is spec-mandated (FR-01 acceptance); the
// other units are sensible defaults the user can change on the form.
// Keys MUST match the priors table in priors.js exactly.
export const CATEGORY_PRESETS = {
  'Cooked food': 'kg',
  'Leafy vegetables': 'g',
  Bread: 'pieces',
  'Milk / dairy': 'L',
  Fruits: 'pieces',
  Eggs: 'pieces',
  'Root vegetables': 'kg',
  'Packaged snacks': 'pieces',
  'Dry staples (rice, pulses, flour)': 'kg',
}
export const CATEGORIES = Object.keys(CATEGORY_PRESETS)

const EVENT_TYPES = ['consumed', 'discarded', 'adjusted']

export function createMemoryStorage() {
  const data = {}
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value)
    },
    removeItem: (key) => {
      delete data[key]
    },
  }
}

function defaultStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Storage blocked (private mode, non-browser runtime): use memory.
  }
  return createMemoryStorage()
}

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    items: [],
    events: [],
    shoppingList: [],
  }
}

function loadFrom(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { state: emptyState(), corrupted: false }
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.items) ||
      !Array.isArray(parsed.events) ||
      !Array.isArray(parsed.shoppingList)
    ) {
      return { state: emptyState(), corrupted: true }
    }
    return {
      state: {
        schemaVersion: SCHEMA_VERSION,
        items: parsed.items,
        events: parsed.events,
        shoppingList: parsed.shoppingList,
      },
      corrupted: false,
    }
  } catch {
    return { state: emptyState(), corrupted: true }
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toNumber(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') {
    return Number(value.trim())
  }
  return Number.NaN
}

/** Status from quantities, per the §7 lifecycle (Expired is derived, never stored). */
function statusFor(quantity, quantityRemaining) {
  if (quantityRemaining === 0) return 'consumed'
  if (quantityRemaining < quantity) return 'partially consumed'
  return 'active'
}

export function createStore(storage = defaultStorage()) {
  const loaded = loadFrom(storage)
  let state = loaded.state
  const corrupted = loaded.corrupted
  const listeners = new Set()

  function save() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or blocked: keep the in-memory state; the app stays usable.
    }
  }

  function setState(next) {
    state = next
    save()
    listeners.forEach((listener) => listener())
  }

  function getItem(id) {
    return state.items.find((item) => item.id === id) ?? null
  }

  return {
    getState: () => state,
    getItem,
    wasCorrupted: () => corrupted,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    addItem(input) {
      const { valid, errors, value } = validateItemInput(input)
      if (!valid) return { ok: false, errors }
      const item = {
        id: generateId(),
        name: value.name,
        category: value.category,
        quantity: value.quantity,
        quantityRemaining: value.quantity,
        unit: value.unit,
        purchaseDate: value.purchaseDate,
        expiryDate: value.expiryDate,
        averageDailyUse: value.averageDailyUse,
        status: 'active',
        source: 'manual',
        externalId: null,
      }
      setState({ ...state, items: [...state.items, item] })
      return { ok: true, item }
    },

    updateItem(id, patch) {
      const existing = getItem(id)
      if (!existing) return { ok: false, error: 'Item not found.' }
      const { valid, errors, value } = validateItemInput({
        ...existing,
        ...patch,
      })
      if (!valid) return { ok: false, errors }
      const remaining = value.quantityRemaining ?? existing.quantityRemaining
      const item = {
        ...existing,
        name: value.name,
        category: value.category,
        quantity: value.quantity,
        quantityRemaining: remaining,
        unit: value.unit,
        purchaseDate: value.purchaseDate,
        expiryDate: value.expiryDate,
        averageDailyUse: value.averageDailyUse,
        status: statusFor(value.quantity, remaining),
      }
      setState({
        ...state,
        items: state.items.map((it) => (it.id === id ? item : it)),
      })
      return { ok: true, item }
    },

    deleteItem(id) {
      if (!getItem(id)) return { ok: false, error: 'Item not found.' }
      // Events are kept: deleting an item does not erase household history.
      setState({
        ...state,
        items: state.items.filter((it) => it.id !== id),
      })
      return { ok: true }
    },

    addAgain(id, today = todayKey()) {
      const source = getItem(id)
      if (!source) return { ok: false, error: 'Item not found.' }
      const item = {
        id: generateId(),
        name: source.name,
        category: source.category,
        quantity: source.quantity,
        quantityRemaining: source.quantity,
        unit: source.unit,
        purchaseDate: today,
        expiryDate: null,
        averageDailyUse: source.averageDailyUse ?? null,
        status: 'active',
        source: 'manual',
        externalId: null,
      }
      setState({ ...state, items: [...state.items, item] })
      return { ok: true, item }
    },

    seedDemo(today = todayKey()) {
      const seed = buildSeed(today)
      setState({
        schemaVersion: SCHEMA_VERSION,
        items: seed.items,
        events: seed.events,
        shoppingList: seed.shoppingList,
      })
      return state
    },

    clearAll() {
      setState(emptyState())
    },

    logEvent(event) {
      const item = getItem(event.itemId)
      if (!item) return { ok: false, error: 'Item not found.' }
      if (!EVENT_TYPES.includes(event.eventType)) {
        return { ok: false, error: 'Unknown event type.' }
      }
      const quantity = toNumber(event.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return { ok: false, error: 'Event quantity must be greater than 0.' }
      }
      const timestamp =
        event.timestamp && isDateLike(event.timestamp)
          ? formatDay(toDayMs(event.timestamp))
          : todayKey()
      let remaining
      let status
      if (event.eventType === 'adjusted') {
        // An adjustment sets the remaining quantity (a correction, not use).
        remaining = quantity
        status = statusFor(item.quantity, remaining)
      } else {
        if (quantity > item.quantityRemaining) {
          return {
            ok: false,
            error: 'Event quantity exceeds the quantity remaining.',
          }
        }
        remaining = item.quantityRemaining - quantity
        status = remaining === 0 ? event.eventType : 'partially consumed'
      }
      const updated = { ...item, quantityRemaining: remaining, status }
      const entry = {
        id: generateId(),
        itemId: item.id,
        category: item.category,
        eventType: event.eventType,
        quantity,
        timestamp,
      }
      setState({
        ...state,
        items: state.items.map((it) => (it.id === item.id ? updated : it)),
        events: [...state.events, entry],
      })
      return { ok: true, item: updated, event: entry }
    },
  }
}
