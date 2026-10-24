// Labelled 60-pair duplicate fixture set — PRD v1.3 FR-04 acceptance
// (precision ≥ 90%, recall ≥ 85%): 20 exact, 20 variant, 20 non-duplicates.
// "Exact" pairs are byte-identical strings. "Variant" pairs differ only by
// packaging words, case, punctuation, whitespace, alias, or a small typo
// that still clears the 0.85 fuzzy threshold. "Non-duplicate" pairs include
// near-misses chosen to sit BELOW 0.85 (plurals, "Milk" vs "Milkshake",
// "Tomatoes" vs "Potatoes") so the threshold's selectivity is tested too.

export const DUPLICATE_FIXTURES = [
  // 20 exact — identical strings.
  ...[
    'Milk',
    'Bread',
    'Rice',
    'Eggs',
    'Curd',
    'Dahi',
    'Sugar',
    'Salt',
    'Butter',
    'Cheese slices',
    'Potatoes',
    'Onions',
    'Bananas',
    'Apples',
    'Spinach',
    'Tomatoes',
    'Pasta',
    'Chips',
    'Biscuits',
    'Yogurt',
  ].map((name) => ({ a: name, b: name, duplicate: true })),

  // 20 variant — same canonical name, different strings.
  { a: 'Milk pack', b: 'Milk', duplicate: true },
  { a: 'Milk pkt', b: 'Milk', duplicate: true },
  { a: 'Milk packet', b: 'Milk', duplicate: true },
  { a: 'Bottle of milk', b: 'Milk', duplicate: true },
  { a: 'Tin of beans', b: 'Beans', duplicate: true },
  { a: 'MILK', b: 'Milk', duplicate: true },
  { a: 'milk', b: 'Milk', duplicate: true },
  { a: 'Whole-wheat bread', b: 'Whole wheat bread', duplicate: true },
  { a: 'Whole  wheat   bread', b: 'Whole wheat bread', duplicate: true },
  { a: 'Dahi', b: 'Curd', duplicate: true },
  { a: 'Curd', b: 'Dahi', duplicate: true },
  { a: 'Bell pepper', b: 'Capsicum', duplicate: true },
  { a: 'Capsicum', b: 'Bell pepper', duplicate: true },
  { a: 'Dahi pack', b: 'Curd', duplicate: true },
  { a: 'Curd packet', b: 'Dahi', duplicate: true },
  { a: 'Bannanas', b: 'Bananas', duplicate: true },
  { a: 'Tomatos', b: 'Tomatoes', duplicate: true },
  { a: 'Spinah', b: 'Spinach', duplicate: true },
  { a: 'Chese slices', b: 'Cheese slices', duplicate: true },
  { a: 'Rice packet', b: 'Rice', duplicate: true },

  // 20 non-duplicates — different items, including near-misses.
  { a: 'Milk', b: 'Milkshake', duplicate: false },
  { a: 'Bread', b: 'Bread crumbs', duplicate: false },
  { a: 'Rice', b: 'Rice flour', duplicate: false },
  { a: 'Egg', b: 'Eggs', duplicate: false },
  { a: 'Curd', b: 'Curds', duplicate: false },
  { a: 'Dal', b: 'Dhal', duplicate: false },
  { a: 'Potato', b: 'Potatoes', duplicate: false },
  { a: 'Milk', b: 'Butter', duplicate: false },
  { a: 'Bread', b: 'Rice', duplicate: false },
  { a: 'Spinach', b: 'Methi', duplicate: false },
  { a: 'Chicken curry', b: 'Dal (cooked)', duplicate: false },
  { a: 'Sugar', b: 'Salt', duplicate: false },
  { a: 'Apples', b: 'Oranges', duplicate: false },
  { a: 'Cheese slices', b: 'Butter', duplicate: false },
  { a: 'Tomatoes', b: 'Potatoes', duplicate: false },
  { a: 'Bananas', b: 'Mangoes', duplicate: false },
  { a: 'Biscuits', b: 'Chips', duplicate: false },
  { a: 'Curd', b: 'Milk', duplicate: false },
  { a: 'Eggs', b: 'Brown eggs', duplicate: false },
  { a: 'Wheat flour', b: 'Rice flour', duplicate: false },
]
