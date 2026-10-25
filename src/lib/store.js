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
import {
  validateItemInput,
  validateShoppingItemInput,
} from './validate.js'

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
    // True when the current dataset originated as the FR-07 demo seed
    // (Module 6: the seed is labelled "Synthetic demo data" in the UI).
    // Cleared only by clearAll; manual edits keep the label, since the
    // dataset is still the demo one, edited.
    demo: false,
    // FR-15 (P2): household members sharing this one on-device
    // inventory. Multi-household sync is out of scope per the PRD, so
    // members are profiles on this device, not accounts.
    members: [],
    activeMemberId: null,
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
        members: Array.isArray(parsed.members)
          ? parsed.members.filter(
              (m) =>
                m &&
                typeof m === 'object' &&
                typeof m.id === 'string' &&
                typeof m.name === 'string',
            )
          : [],
        activeMemberId:
          typeof parsed.activeMemberId === 'string'
            ? parsed.activeMemberId
            : null,
        // States saved before the flag existed are recognised by the
        // seed items' id prefix (manual items get random UUIDs, never
        // "seed-"), so the label survives the upgrade.
        demo:
          parsed.demo === true ||
          (parsed.demo === undefined &&
            parsed.items.some(
              (it) => typeof it.id === 'string' && it.id.startsWith('seed-'),
            )),
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
        source: value.source,
        externalId: value.externalId,
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
        source: value.source,
        externalId: value.externalId,
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

    addShoppingItem(input) {
      const { valid, errors, value } = validateShoppingItemInput(input)
      if (!valid) return { ok: false, errors }
      const item = {
        id: generateId(),
        name: value.name,
        quantityWanted: value.quantityWanted,
        unit: value.unit,
      }
      setState({ ...state, shoppingList: [...state.shoppingList, item] })
      return { ok: true, item }
    },

    updateShoppingItem(id, patch) {
      const existing = state.shoppingList.find((it) => it.id === id)
      if (!existing) return { ok: false, error: 'List item not found.' }
      const { valid, errors, value } = validateShoppingItemInput({
        ...existing,
        ...patch,
      })
      if (!valid) return { ok: false, errors }
      const item = { ...existing, ...value }
      setState({
        ...state,
        shoppingList: state.shoppingList.map((it) =>
          it.id === id ? item : it,
        ),
      })
      return { ok: true, item }
    },

    deleteShoppingItem(id) {
      if (!state.shoppingList.some((it) => it.id === id)) {
        return { ok: false, error: 'List item not found.' }
      }
      setState({
        ...state,
        shoppingList: state.shoppingList.filter((it) => it.id !== id),
      })
      return { ok: true }
    },

    seedDemo(today = todayKey()) {
      const seed = buildSeed(today)
      setState({
        schemaVersion: SCHEMA_VERSION,
        items: seed.items,
        events: seed.events,
        shoppingList: seed.shoppingList,
        demo: true,
        members: [],
        activeMemberId: null,
      })
      return state
    },

    // FR-15 (P2): household members. Events log under the active
    // member, so the Insights tab can show who used what.
    addMember(name) {
      const clean = typeof name === 'string' ? name.trim() : ''
      if (clean === '') return { ok: false, error: 'Name is required.' }
      const member = { id: generateId(), name: clean }
      setState({ ...state, members: [...state.members, member] })
      return { ok: true, member }
    },

    setActiveMember(id) {
      if (id !== null && !state.members.some((m) => m.id === id)) {
        return { ok: false, error: 'Member not found.' }
      }
      setState({ ...state, activeMemberId: id })
      return { ok: true }
    },

    clearAll() {
      setState(emptyState())
    },

    // FR-12 (P1): export the whole state as JSON. The exported items
    // array is the visible inventory, field for field — including the
    // FR-13 source/externalId values, which is what makes the FR-13
    // round-trip work.
    exportJSON() {
      return JSON.stringify(state)
    },

    // FR-12 (P1): restore a previously exported file. Shape-checked,
    // not version-gated, so older exports still load; items, events,
    // and list entries are stored verbatim (ids, statuses, sources,
    // externalIds included) — nothing is re-derived or dropped. A bad
    // file is rejected without touching the current state.
    importJSON(text) {
      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        return { ok: false, error: 'That file is not valid JSON.' }
      }
      const bad = (why) => ({ ok: false, error: why })
      if (!parsed || typeof parsed !== 'object') return bad('Bad export format.')
      if (!Array.isArray(parsed.items)) return bad('Bad export format: items.')
      if (!Array.isArray(parsed.events)) return bad('Bad export format: events.')
      if (!Array.isArray(parsed.shoppingList)) {
        return bad('Bad export format: shoppingList.')
      }
      const itemOk = (it) =>
        it &&
        typeof it === 'object' &&
        typeof it.id === 'string' &&
        typeof it.name === 'string' &&
        it.name.trim() !== '' &&
        typeof it.category === 'string' &&
        it.category.trim() !== '' &&
        typeof it.unit === 'string' &&
        it.unit.trim() !== '' &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0 &&
        Number.isFinite(it.quantityRemaining) &&
        it.quantityRemaining >= 0
      const eventOk = (e) =>
        e &&
        typeof e === 'object' &&
        typeof e.itemId === 'string' &&
        EVENT_TYPES.includes(e.eventType) &&
        Number.isFinite(e.quantity) &&
        e.quantity > 0 &&
        typeof e.timestamp === 'string'
      const listOk = (li) =>
        li &&
        typeof li === 'object' &&
        typeof li.name === 'string' &&
        li.name.trim() !== '' &&
        Number.isFinite(li.quantityWanted) &&
        li.quantityWanted > 0 &&
        typeof li.unit === 'string' &&
        li.unit.trim() !== ''
      if (!parsed.items.every(itemOk)) return bad('Bad export format: item.')
      if (!parsed.events.every(eventOk)) return bad('Bad export format: event.')
      if (!parsed.shoppingList.every(listOk)) {
        return bad('Bad export format: list item.')
      }
      setState({
        schemaVersion: SCHEMA_VERSION,
        items: parsed.items,
        events: parsed.events,
        shoppingList: parsed.shoppingList,
        demo: parsed.demo === true,
        members: Array.isArray(parsed.members)
          ? parsed.members.filter(
              (m) =>
                m &&
                typeof m === 'object' &&
                typeof m.id === 'string' &&
                typeof m.name === 'string',
            )
          : [],
        activeMemberId:
          typeof parsed.activeMemberId === 'string'
            ? parsed.activeMemberId
            : null,
      })
      return {
        ok: true,
        imported: {
          items: parsed.items.length,
          events: parsed.events.length,
          shoppingList: parsed.shoppingList.length,
        },
      }
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
      // FR-15 (P2): attribute the event to the active household member.
      // The name is snapshotted so renames and removals never rewrite
      // history; null when nobody is active.
      const activeMember =
        state.members.find((m) => m.id === state.activeMemberId) ?? null
      const entry = {
        id: generateId(),
        itemId: item.id,
        category: item.category,
        eventType: event.eventType,
        quantity,
        timestamp,
        memberId: activeMember ? activeMember.id : null,
        memberName: activeMember ? activeMember.name : null,
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
