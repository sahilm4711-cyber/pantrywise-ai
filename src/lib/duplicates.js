// Duplicate matching — PRD v1.3 §6.4 pipeline and FR-04.
// Order: normalize → strip packaging words → alias → exact match on the
// canonical name → Levenshtein fuzzy match (similarity ≥ 0.85).
//
// Match kinds:
// - 'exact': the two strings are byte-identical.
// - 'variant': canonical names equal but strings differ (packaging words,
//   case, punctuation, whitespace, or alias — e.g. "Bread pack" vs "Bread").
// - 'fuzzy': canonicals differ but similarity ≥ 0.85 ("probable duplicate —
//   review", never an automatic action).
// - 'none': no match.
//
// Module decisions (flagged, not hidden):
// - The alias table is exactly the PRD's examples (curd↔dahi,
//   capsicum↔bell pepper), kept minimal on purpose: every invented alias is
//   a future false duplicate. The team can extend it deliberately.
// - After stripping a packaging word, a leftover leading "of" is dropped
//   too ("packet of milk" → "milk"); the spec lists "packet" but not
//   "packet of", and no real item name starts with "of".

export const FUZZY_THRESHOLD = 0.85

const PACKAGING_PHRASES = ['bottle of', 'tin of']
const PACKAGING_WORDS = new Set(['pack', 'pkt', 'packet'])
const ALIASES = {
  dahi: 'curd',
  'bell pepper': 'capsicum',
}

/** Lowercase, turn punctuation into spaces, collapse whitespace. */
export function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Canonical name after packaging-word stripping and alias resolution. */
export function canonicalName(name) {
  let s = normalizeName(name)
  for (const phrase of PACKAGING_PHRASES) {
    s = s.replace(new RegExp(`\\b${phrase}\\b`, 'g'), ' ')
  }
  const tokens = s
    .split(' ')
    .filter((t) => t !== '' && !PACKAGING_WORDS.has(t))
  if (tokens[0] === 'of') tokens.shift()
  s = tokens.join(' ')
  return ALIASES[s] ?? s
}

/** Classic Levenshtein edit distance. */
export function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  let curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

/** Similarity in [0, 1]: 1 − distance / longer length. */
export function similarity(a, b) {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

/** Pairwise match between two names (used by the fixture evaluation). */
export function matchPair(nameA, nameB) {
  const canonA = canonicalName(nameA)
  const canonB = canonicalName(nameB)
  if (canonA === '' || canonB === '') {
    return { kind: 'none', similarity: 0 }
  }
  if (canonA === canonB) {
    return {
      kind: nameA === nameB ? 'exact' : 'variant',
      similarity: 1,
    }
  }
  const sim = similarity(canonA, canonB)
  return sim >= FUZZY_THRESHOLD
    ? { kind: 'fuzzy', similarity: sim }
    : { kind: 'none', similarity: sim }
}

/** Best inventory match for a shopping-list name, or kind 'none'. */
export function findMatch(listName, items) {
  const canon = canonicalName(listName)
  if (canon === '') return { kind: 'none', item: null, similarity: null }
  const byExpiryThenId = (x, y) => {
    const ex = (x.expiryDate ?? '9999-99-99').localeCompare(
      y.expiryDate ?? '9999-99-99',
    )
    return ex !== 0 ? ex : String(x.id).localeCompare(String(y.id))
  }
  const exact = items.filter((item) => item.name === listName)
  if (exact.length > 0) {
    return { kind: 'exact', item: [...exact].sort(byExpiryThenId)[0], similarity: 1 }
  }
  const variant = items.filter(
    (item) => canonicalName(item.name) === canon,
  )
  if (variant.length > 0) {
    return {
      kind: 'variant',
      item: [...variant].sort(byExpiryThenId)[0],
      similarity: 1,
    }
  }
  let best = null
  for (const item of items) {
    const sim = similarity(canon, canonicalName(item.name))
    if (sim >= FUZZY_THRESHOLD && (!best || sim > best.similarity)) {
      best = { kind: 'fuzzy', item, similarity: sim }
    }
  }
  return best ?? { kind: 'none', item: null, similarity: null }
}

/**
 * Evaluate a labelled fixture set: pairs are { a, b, duplicate }.
 * Returns precision/recall plus the mispredicted pairs for debugging.
 */
export function evaluateFixtures(pairs) {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  const failures = []
  for (const pair of pairs) {
    const predicted = matchPair(pair.a, pair.b).kind !== 'none'
    if (predicted && pair.duplicate) tp += 1
    else if (predicted && !pair.duplicate) {
      fp += 1
      failures.push({ ...pair, predicted: true })
    } else if (!predicted && pair.duplicate) {
      fn += 1
      failures.push({ ...pair, predicted: false })
    } else tn += 1
  }
  return {
    tp,
    fp,
    fn,
    tn,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn),
    failures,
  }
}
