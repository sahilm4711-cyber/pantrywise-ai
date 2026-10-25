// Receipt import prototype — PRD v1.3 FR-14 (P2).
// A deterministic line parser, not OCR and not an LLM: every line is
// either parsed with certainty or flagged uncertain for the user to
// fix in review. Nothing is saved before the user confirms (the view
// owns that step). Categories are inferred from a small keyword map;
// anything unrecognised is flagged, never guessed silently.

export const KNOWN_UNITS = ['g', 'kg', 'ml', 'l', 'pieces', 'dozen']
const PACKAGING_WORDS = ['pack', 'packet', 'pkt', 'bottle', 'tin', 'box', 'bag']
const SKIP_PATTERNS = [
  /total/i,
  /\btax\b/i,
  /\bgst\b/i,
  /change/i,
  /balance/i,
  /thank you/i,
  /visit again/i,
  /^cash\b/i,
  /^card\b/i,
]

const CATEGORY_KEYWORDS = [
  [/milk|curd|dahi|cheese|butter|cream|yogurt/, 'Milk / dairy'],
  [/bread|bun|toast/, 'Bread'],
  [/rice|flour|atta|dal|pulses|lentil|oats|wheat|salt|sugar|spice/, 'Dry staples (rice, pulses, flour)'],
  [/spinach|methi|lettuce|kale|saag/, 'Leafy vegetables'],
  [/tomato|banana|apple|mango|orange|fruit|grapes/, 'Fruits'],
  [/potato|onion|carrot|beet|yam|ginger/, 'Root vegetables'],
  [/egg/, 'Eggs'],
  [/biscuit|chips|namkeen|snack|chocolate/, 'Packaged snacks'],
  [/sabzi|curry|cooked|meal|rice bowl/, 'Cooked food'],
]

export function inferCategory(name) {
  const lower = name.toLowerCase()
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(lower)) return category
  }
  return null
}

export function normalizeUnit(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === 'l') return 'L'
  if (lower === 'pcs' || lower === 'piece') return 'pieces'
  if (KNOWN_UNITS.includes(lower)) return lower
  return null
}

function parseLine(raw) {
  const line = raw.trim()
  if (line === '') return null
  if (SKIP_PATTERNS.some((p) => p.test(line))) return { skipped: true, raw }
  let rest = line
  let quantity = null
  const timesMatch = rest.match(/^(\d+(?:\.\d+)?)\s*x\s*(.+)$/i)
  if (timesMatch) {
    quantity = Number(timesMatch[1])
    rest = timesMatch[2].trim()
  }
  // Trailing "name qty unit" or "name qty".
  const tailMatch = rest.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*([A-Za-z]+)?$/)
  if (tailMatch) {
    const name = tailMatch[1].trim()
    const qty = Number(tailMatch[2])
    const unitWord = tailMatch[3] ? tailMatch[3].trim() : null
    if (quantity === null) quantity = qty
    let unit = null
    let uncertain = []
    if (unitWord) {
      if (PACKAGING_WORDS.includes(unitWord.toLowerCase())) {
        uncertain = ['unit']
      } else {
        unit = normalizeUnit(unitWord)
        if (!unit) {
          // Unknown trailing word belongs to the name, not the unit.
          uncertain = ['unit']
          return finish(`${name} ${unitWord}`, quantity, null, uncertain)
        }
      }
    } else {
      uncertain = ['unit']
    }
    return finish(name, quantity, unit, uncertain)
  }
  // No number at all: a name with everything missing.
  return finish(rest, null, null, ['quantity', 'unit'])
}

function finish(name, quantity, unit, uncertain) {
  const category = inferCategory(name)
  if (!category) uncertain = [...uncertain, 'category']
  return {
    skipped: false,
    raw: name,
    name,
    quantity,
    unit,
    category,
    uncertain,
  }
}

export function parseReceipt(text) {
  const lines = []
  let skipped = 0
  const rawLines = String(text ?? '').split('\n')
  // Header heuristic: receipts usually open with a store name line
  // that has no digits. Skip the first non-empty line when it has
  // none, rather than offering it as an item.
  const firstContent = rawLines.findIndex((l) => l.trim() !== '')
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i]
    if (raw.trim() === '') continue
    if (i === firstContent && !/\d/.test(raw)) {
      skipped += 1
      continue
    }
    const parsed = parseLine(raw)
    if (!parsed) continue
    if (parsed.skipped) {
      skipped += 1
    } else {
      lines.push(parsed)
    }
  }
  return { lines, skipped }
}

export const SAMPLE_RECEIPT = `Fresh Mart
Milk 1 L
2 x Bread 1 pack
Rice 5 kg
Eggs 12 pieces
Tomatoes 1 kg
Dragon fruit 2
TOTAL 45.00
Thank you, visit again`
