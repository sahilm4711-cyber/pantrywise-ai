// Unit conversion — PRD v1.3 §6.4. Quantities convert only within a
// dimension (mass g↔kg, volume ml↔L, count pieces↔dozen). Anything else —
// cross-dimension or unknown unit — returns null, and the caller routes
// that pair to "Review data" instead of guessing.

const UNITS = {
  g: { dimension: 'mass', toBase: 1 },
  kg: { dimension: 'mass', toBase: 1000 },
  ml: { dimension: 'volume', toBase: 1 },
  l: { dimension: 'volume', toBase: 1000 },
  pieces: { dimension: 'count', toBase: 1 },
  dozen: { dimension: 'count', toBase: 12 },
}

/** Normalize a unit string ('L' → 'l', ' Pieces ' → 'pieces'), or null. */
export function normalizeUnit(unit) {
  if (typeof unit !== 'string') return null
  const key = unit.trim().toLowerCase()
  return key === '' ? null : key
}

/** Convert `value` from `fromUnit` to `toUnit`; null when unconvertible. */
export function convertQuantity(value, fromUnit, toUnit) {
  const from = UNITS[normalizeUnit(fromUnit) ?? '']
  const to = UNITS[normalizeUnit(toUnit) ?? '']
  if (!from || !to) return null
  if (from.dimension !== to.dimension) return null
  return (value * from.toBase) / to.toBase
}
