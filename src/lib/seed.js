// Synthetic demo dataset — PRD v1.3 FR-07.
// 40 inventory items spanning all 9 shelf-life categories (a family-of-four
// household, mirroring Persona A) plus a 5-item shopping list.
//
// Dates are RELATIVE to the day the seed loads, so the demo never rots:
// an item at expiry offset +1 always expires tomorrow, whatever day the
// judge loads it. buildSeed(today) is deterministic for a given day,
// which is what the tests assert.
//
// The seed is engineered to trigger all 7 §6.6 scenarios:
//  (1) approaching expiry + large remaining — Milk, Dal, Spinach, Methi
//  (2) distant expiry + low quantity — Cheese slices, Rice, Sugar
//  (3) missing expiry, category + purchase date known — Tomatoes (estimated)
//  (4) missing expiry AND purchase date — Salt (insufficient-data)
//  (5) list item adequately stocked — Rice (cover 20 days → Skip)
//  (6) list item absent from inventory — Oats (→ Keep)
//  (7) variant-name duplicate — "Bread pack" (packaging word stripped → Bread)
// Plus a learning-loop demo: Curd carries 3 consumed events, so its daily
// use resolves as Learned (3 events) via FR-09.

import { addDays } from './dates.js'

// [id, name, category, quantity, unit, dailyUse|null,
//  purchaseOffsetDays|null, expiryOffsetDays|null, quantityRemaining?]
// Category strings MUST match the priors table in priors.js exactly.
const ITEMS = [
  ['seed-milk', 'Milk', 'Milk / dairy', 2.0, 'L', 0.5, -1, 1],
  ['seed-curd', 'Curd', 'Milk / dairy', 2.0, 'kg', null, -4, 2, 0.5],
  ['seed-cheese', 'Cheese slices', 'Milk / dairy', 10, 'pieces', 1, -5, 30],
  ['seed-butter', 'Butter', 'Milk / dairy', 0.5, 'kg', 0.05, -3, 20],
  ['seed-yogurt', 'Yogurt', 'Milk / dairy', 0.4, 'kg', 0.1, -1, 5],
  ['seed-bread', 'Bread', 'Bread', 1, 'pieces', 0.25, -1, 3],
  ['seed-ww-bread', 'Whole wheat bread', 'Bread', 1, 'pieces', 0.2, -2, 2],
  ['seed-buns', 'Buns', 'Bread', 6, 'pieces', 1, -1, 4],
  ['seed-pav', 'Pav', 'Bread', 8, 'pieces', 2, 0, 6],
  ['seed-dal', 'Dal (cooked)', 'Cooked food', 1.5, 'kg', 0.3, -1, 1],
  ['seed-rice-cooked', 'Rice (cooked)', 'Cooked food', 2.0, 'kg', 0.5, -1, 2],
  ['seed-sabzi', 'Vegetable sabzi', 'Cooked food', 1.0, 'kg', 0.25, -2, 1],
  ['seed-chicken', 'Chicken curry', 'Cooked food', 1.2, 'kg', 0.3, 0, 3],
  ['seed-spinach', 'Spinach', 'Leafy vegetables', 0.5, 'kg', 0.1, -2, 1],
  ['seed-coriander', 'Coriander', 'Leafy vegetables', 0.1, 'kg', 0.02, -1, 2],
  ['seed-lettuce', 'Lettuce', 'Leafy vegetables', 0.3, 'kg', 0.05, -1, 5],
  ['seed-methi', 'Methi', 'Leafy vegetables', 0.25, 'kg', 0.05, -3, 1],
  ['seed-bananas', 'Bananas', 'Fruits', 12, 'pieces', 2, -2, 2],
  ['seed-apples', 'Apples', 'Fruits', 6, 'pieces', 1, -3, 10],
  ['seed-mangoes', 'Mangoes', 'Fruits', 4, 'pieces', 0.5, -1, 3],
  ['seed-grapes', 'Grapes', 'Fruits', 0.5, 'kg', 0.1, -1, 4],
  ['seed-oranges', 'Oranges', 'Fruits', 8, 'pieces', 1, -2, 6],
  ['seed-tomatoes', 'Tomatoes', 'Fruits', 1.0, 'kg', 0.2, -2, null],
  ['seed-eggs', 'Eggs', 'Eggs', 12, 'pieces', 2, -4, 17],
  ['seed-brown-eggs', 'Brown eggs', 'Eggs', 6, 'pieces', 1, -2, 12],
  ['seed-potatoes', 'Potatoes', 'Root vegetables', 5.0, 'kg', 0.5, -5, 25],
  ['seed-onions', 'Onions', 'Root vegetables', 3.0, 'kg', 0.3, -4, 20],
  ['seed-carrots', 'Carrots', 'Root vegetables', 1.0, 'kg', 0.2, -3, 8],
  ['seed-beetroot', 'Beetroot', 'Root vegetables', 0.5, 'kg', 0.1, -2, 6],
  ['seed-sweet-potatoes', 'Sweet potatoes', 'Root vegetables', 2.0, 'kg', 0.25, -6, 15],
  ['seed-biscuits', 'Biscuits', 'Packaged snacks', 2, 'pieces', 0.25, -10, 80],
  ['seed-chips', 'Chips', 'Packaged snacks', 3, 'pieces', 0.5, -5, 60],
  ['seed-namkeen', 'Namkeen', 'Packaged snacks', 1.0, 'kg', 0.1, -8, 45],
  ['seed-chocolates', 'Chocolates', 'Packaged snacks', 10, 'pieces', 1, -3, 90],
  ['seed-rice', 'Rice', 'Dry staples (rice, pulses, flour)', 10.0, 'kg', 0.5, -20, 300],
  ['seed-tur-dal', 'Tur dal', 'Dry staples (rice, pulses, flour)', 2.0, 'kg', 0.1, -15, 200],
  ['seed-flour', 'Wheat flour', 'Dry staples (rice, pulses, flour)', 5.0, 'kg', 0.25, -10, 150],
  ['seed-sugar', 'Sugar', 'Dry staples (rice, pulses, flour)', 2.0, 'kg', 0.1, -12, 400],
  ['seed-pasta', 'Pasta', 'Dry staples (rice, pulses, flour)', 1.0, 'kg', 0.1, -6, 350],
  ['seed-salt', 'Salt', 'Dry staples (rice, pulses, flour)', 1.0, 'kg', 0.05, null, null],
]

// [id, name, quantityWanted, unit]
const SHOPPING_LIST = [
  ['seed-list-milk', 'Milk', 1, 'L'],
  ['seed-list-bread-pack', 'Bread pack', 1, 'pieces'],
  ['seed-list-rice', 'Rice', 2, 'kg'],
  ['seed-list-bananas', 'Bananas', 20, 'pieces'],
  ['seed-list-oats', 'Oats', 1, 'kg'],
]

export function buildSeed(today) {
  const items = ITEMS.map(
    ([
      id,
      name,
      category,
      quantity,
      unit,
      dailyUse,
      purchaseOffset,
      expiryOffset,
      remaining,
    ]) => ({
      id,
      name,
      category,
      quantity,
      quantityRemaining: remaining ?? quantity,
      unit,
      purchaseDate:
        purchaseOffset === null ? null : addDays(today, purchaseOffset),
      expiryDate: expiryOffset === null ? null : addDays(today, expiryOffset),
      averageDailyUse: dailyUse,
      status:
        remaining !== undefined && remaining < quantity
          ? 'partially consumed'
          : 'active',
      source: 'manual',
      externalId: null,
    }),
  )
  const events = [-3, -2, 0].map((offset, i) => ({
    id: `seed-event-curd-${i + 1}`,
    itemId: 'seed-curd',
    category: 'Milk / dairy',
    eventType: 'consumed',
    quantity: 0.5,
    timestamp: addDays(today, offset),
  }))
  const shoppingList = SHOPPING_LIST.map(
    ([id, name, quantityWanted, unit]) => ({
      id,
      name,
      quantityWanted,
      unit,
    }),
  )
  return { items, events, shoppingList }
}
