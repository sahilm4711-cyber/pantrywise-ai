import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStorage, createStore } from './store.js'

test('shopping list CRUD persists across a simulated refresh', () => {
  const storage = createMemoryStorage()
  const store = createStore(storage)
  const added = store.addShoppingItem({
    name: 'Oats',
    quantityWanted: 1,
    unit: 'kg',
  })
  assert.equal(added.ok, true)
  assert.equal(added.item.name, 'Oats')
  const edited = store.updateShoppingItem(added.item.id, {
    quantityWanted: 2,
  })
  assert.equal(edited.ok, true)
  assert.equal(edited.item.quantityWanted, 2)
  const reloaded = createStore(storage)
  assert.equal(reloaded.getState().shoppingList.length, 1)
  assert.equal(reloaded.getState().shoppingList[0].quantityWanted, 2)
  assert.equal(store.deleteShoppingItem(added.item.id).ok, true)
  assert.deepEqual(createStore(storage).getState().shoppingList, [])
})

test('shopping validation rejects bad input; unknown ids fail', () => {
  const store = createStore(createMemoryStorage())
  assert.equal(
    store.addShoppingItem({ name: ' ', quantityWanted: 1, unit: 'kg' }).ok,
    false,
  )
  assert.equal(
    store.addShoppingItem({ name: 'Oats', quantityWanted: 0, unit: 'kg' })
      .errors.quantityWanted,
    'Quantity must be a number greater than 0.',
  )
  assert.equal(store.updateShoppingItem('nope', { name: 'X' }).ok, false)
  assert.equal(store.deleteShoppingItem('nope').ok, false)
})

test('seeded shopping list accepts new items alongside', () => {
  const store = createStore(createMemoryStorage())
  store.seedDemo('2026-10-24')
  store.addShoppingItem({ name: 'Oats', quantityWanted: 1, unit: 'kg' })
  assert.equal(store.getState().shoppingList.length, 6)
})
