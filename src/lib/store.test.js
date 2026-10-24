import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CATEGORIES,
  CATEGORY_PRESETS,
  STORAGE_KEY,
  createMemoryStorage,
  createStore,
} from './store.js'

const ITEM = {
  name: 'Milk',
  category: 'Milk / dairy',
  quantity: 2,
  unit: 'L',
  purchaseDate: '2026-10-23',
  expiryDate: '2026-10-25',
  averageDailyUse: 0.5,
}

test('addItem stores a new active item with remaining = quantity', () => {
  const store = createStore(createMemoryStorage())
  const result = store.addItem(ITEM)
  assert.equal(result.ok, true)
  assert.equal(result.item.name, 'Milk')
  assert.equal(result.item.quantityRemaining, 2)
  assert.equal(result.item.status, 'active')
  assert.equal(result.item.source, 'manual')
  assert.equal(result.item.externalId, null)
  assert.equal(typeof result.item.id, 'string')
  assert.equal(store.getItem(result.item.id).name, 'Milk')
})

test('addItem coerces string numbers from the form', () => {
  const store = createStore(createMemoryStorage())
  const result = store.addItem({ ...ITEM, quantity: '2', averageDailyUse: '0.5' })
  assert.equal(result.ok, true)
  assert.equal(result.item.quantity, 2)
  assert.equal(result.item.averageDailyUse, 0.5)
})

test('added items survive a simulated refresh (new store, same storage)', () => {
  const storage = createMemoryStorage()
  const first = createStore(storage)
  const added = first.addItem(ITEM)
  assert.equal(added.ok, true)
  const reloaded = createStore(storage)
  const found = reloaded.getItem(added.item.id)
  assert.equal(found.name, 'Milk')
  assert.equal(found.quantityRemaining, 2)
})

test('updateItem edits quantity remaining, updates status, and persists', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)
  const added = store.addItem(ITEM)
  const edited = store.updateItem(added.item.id, { quantityRemaining: 1 })
  assert.equal(edited.ok, true)
  assert.equal(edited.item.quantityRemaining, 1)
  assert.equal(edited.item.status, 'partially consumed')
  const reloaded = createStore(storage)
  assert.equal(reloaded.getItem(added.item.id).quantityRemaining, 1)
  const finished = store.updateItem(added.item.id, { quantityRemaining: 0 })
  assert.equal(finished.item.status, 'consumed')
})

test('updateItem on an unknown id fails', () => {
  const store = createStore(createMemoryStorage())
  assert.equal(store.updateItem('nope', { name: 'X' }).ok, false)
})

test('deleteItem removes the item and it stays deleted after reload', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)
  const added = store.addItem(ITEM)
  assert.equal(store.deleteItem(added.item.id).ok, true)
  assert.equal(store.getItem(added.item.id), null)
  const reloaded = createStore(storage)
  assert.equal(reloaded.getItem(added.item.id), null)
})

test('validation rejects empty names, bad quantities, and bad dates', () => {
  const store = createStore(createMemoryStorage())
  assert.deepEqual(Object.keys(store.addItem({ ...ITEM, name: '  ' }).errors), [
    'name',
  ])
  assert.equal(store.addItem({ ...ITEM, quantity: 0 }).errors.quantity, 'Quantity must be a number greater than 0.')
  assert.equal(store.addItem({ ...ITEM, quantity: -1 }).errors.quantity, 'Quantity must be a number greater than 0.')
  assert.equal(store.addItem({ ...ITEM, quantity: 'abc' }).errors.quantity, 'Quantity must be a number greater than 0.')
  assert.equal(store.addItem({ ...ITEM, purchaseDate: '2026-02-30' }).errors.purchaseDate, 'Purchase date is not a valid date.')
  assert.equal(store.addItem({ ...ITEM, expiryDate: 'not-a-date' }).errors.expiryDate, 'Expiry date is not a valid date.')
  assert.equal(store.addItem({ ...ITEM, averageDailyUse: -1 }).errors.averageDailyUse, 'Daily use must be a number greater than 0.')
  assert.equal(store.addItem({ ...ITEM, unit: '' }).errors.unit, 'Unit is required.')
})

test('missing expiry date is allowed (engine estimates it from the prior)', () => {
  const store = createStore(createMemoryStorage())
  const result = store.addItem({ ...ITEM, expiryDate: '' })
  assert.equal(result.ok, true)
  assert.equal(result.item.expiryDate, null)
})

test('addAgain copies the item with today as purchase date and a fresh expiry', () => {
  const store = createStore(createMemoryStorage())
  const added = store.addItem(ITEM)
  const again = store.addAgain(added.item.id, '2026-10-24')
  assert.equal(again.ok, true)
  assert.notEqual(again.item.id, added.item.id)
  assert.equal(again.item.name, 'Milk')
  assert.equal(again.item.unit, 'L')
  assert.equal(again.item.averageDailyUse, 0.5)
  assert.equal(again.item.purchaseDate, '2026-10-24')
  assert.equal(again.item.expiryDate, null)
  assert.equal(again.item.quantityRemaining, 2)
  assert.equal(again.item.status, 'active')
})

test('logEvent consumes, discards, adjusts, and rejects over-consumption', () => {
  const store = createStore(createMemoryStorage())
  const added = store.addItem(ITEM)
  const id = added.item.id
  const partial = store.logEvent({
    itemId: id,
    eventType: 'consumed',
    quantity: 0.5,
  })
  assert.equal(partial.ok, true)
  assert.equal(partial.item.quantityRemaining, 1.5)
  assert.equal(partial.item.status, 'partially consumed')
  assert.equal(
    store.logEvent({ itemId: id, eventType: 'consumed', quantity: 5 }).ok,
    false,
  )
  const done = store.logEvent({
    itemId: id,
    eventType: 'discarded',
    quantity: 1.5,
  })
  assert.equal(done.item.quantityRemaining, 0)
  assert.equal(done.item.status, 'discarded')
  assert.equal(
    store.logEvent({ itemId: 'missing', eventType: 'consumed', quantity: 1 }).ok,
    false,
  )
  const store2 = createStore(createMemoryStorage())
  const added2 = store2.addItem(ITEM)
  const adjusted = store2.logEvent({
    itemId: added2.item.id,
    eventType: 'adjusted',
    quantity: 1,
  })
  assert.equal(adjusted.item.quantityRemaining, 1)
  assert.equal(adjusted.item.status, 'partially consumed')
})

test('subscribers are notified on mutation', () => {
  const store = createStore(createMemoryStorage())
  let calls = 0
  const unsubscribe = store.subscribe(() => {
    calls += 1
  })
  store.addItem(ITEM)
  assert.equal(calls, 1)
  unsubscribe()
  store.addItem({ ...ITEM, name: 'Curd' })
  assert.equal(calls, 1)
})

test('corrupt stored JSON degrades to an empty state, never a crash', () => {
  const storage = createMemoryStorage()
  storage.setItem(STORAGE_KEY, '{not json')
  const store = createStore(storage)
  assert.equal(store.wasCorrupted(), true)
  assert.deepEqual(store.getState().items, [])
})

test('category presets cover all 9 prior categories; Milk / dairy is litres', () => {
  assert.equal(CATEGORIES.length, 9)
  assert.equal(CATEGORY_PRESETS['Milk / dairy'], 'L')
})

test('seedDemo replaces the current inventory with the demo dataset', () => {
  const store = createStore(createMemoryStorage())
  store.addItem(ITEM)
  store.seedDemo('2026-10-24')
  assert.equal(store.getState().items.length, 40)
  assert.equal(store.getState().shoppingList.length, 5)
})
