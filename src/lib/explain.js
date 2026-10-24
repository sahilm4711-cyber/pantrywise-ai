// Human explanations for scores — PRD v1.3 FR-03 (reason codes shown) and
// the optional /api/explain contract (§7).
//
// Two layers:
// - reasonText(code): one plain line per reason code. Codes are
//   value-derived by the engine, so the text is generated from the number
//   inside the code (EXPIRY_3_DAY → "Expires in 3 days").
// - templateExplanation(entry): the guaranteed fallback — built only from
//   the scored facts, never from an LLM. The PRD's /api/explain endpoint is
//   optional and this prototype has no backend, so the template IS what
//   ships; explainItem() is the hook where a future endpoint plugs in
//   (pass options.llmExplain; failures and timeouts fall back to template).

export function reasonText(code) {
  if (code === 'EXPIRY_PAST_DUE') return 'Already expired'
  if (code === 'EXPIRY_TODAY') return 'Expires today'
  const dayMatch = /^EXPIRY_(\d+)_DAY$/.exec(code)
  if (dayMatch) {
    const n = Number(dayMatch[1])
    return n === 1 ? 'Expires in 1 day' : `Expires in ${n} days`
  }
  const excessMatch = /^EXCESS_(\d+)_PCT$/.exec(code)
  if (excessMatch) {
    const pct = Number(excessMatch[1])
    return pct === 0
      ? "You'll use it all before expiry"
      : `${pct}% more than you will use before expiry`
  }
  if (code === 'USE_RATE_USER_ENTERED') return 'Daily use you entered'
  if (code === 'USE_RATE_LEARNED') return 'Daily use learned from your history'
  if (code === 'USE_RATE_PRIOR') return 'Daily use estimated from category'
  if (code === 'EXPIRY_ESTIMATED') {
    return 'Expiry estimated from category shelf life'
  }
  if (code === 'INSUFFICIENT_DATA') return 'Not enough information to score'
  if (code === 'ZERO_QUANTITY') return 'Nothing left'
  if (code === 'INVALID_QUANTITY') return 'Invalid quantity'
  return code
}

/** Trim float dust (0.30000000000000004 → 0.3) for display. */
function fmt(n) {
  return Number(n.toFixed(2))
}

export function templateExplanation(entry) {
  const { item, daysLeft, excessQuantity, excessScore, dailyUse, band } = entry
  let expiryPart
  if (daysLeft < 0) expiryPart = 'already expired'
  else if (daysLeft === 0) expiryPart = 'expires today'
  else if (daysLeft === 1) expiryPart = 'expires in 1 day'
  else expiryPart = `expires in ${daysLeft} days`
  const estimated =
    entry.expiryConfidence === 'Estimated (prior)' ? ' (estimated)' : ''
  const first = `${item.name} ${expiryPart}${estimated}.`
  const second =
    excessQuantity > 0
      ? `You have ${fmt(item.quantityRemaining)} ${item.unit} left, using about ${fmt(dailyUse)} a day, so ${fmt(excessQuantity)} ${item.unit} (${excessScore}%) will still be left at expiry.`
      : `You have ${fmt(item.quantityRemaining)} ${item.unit} left, using about ${fmt(dailyUse)} a day, so you should finish it by expiry.`
  const nudge =
    band === 'High'
      ? 'Use it soon.'
      : band === 'Medium'
        ? 'Plan to use it before expiry.'
        : 'No action needed yet.'
  return `${first} ${second} ${nudge}`
}

/**
 * The /api/explain hook. Without options.llmExplain this is just the
 * template. With one, the LLM text wins when it resolves in time and is
 * non-empty; any failure, empty reply, or timeout returns the template —
 * an explanation never blocks or breaks the list (PRD §7 fallback rule).
 */
export async function explainItem(entry, options = {}) {
  const fallback = templateExplanation(entry)
  const llmExplain = options.llmExplain
  if (typeof llmExplain !== 'function') return fallback
  const timeoutMs = options.timeoutMs ?? 3000
  try {
    const text = await Promise.race([
      llmExplain(entry),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs),
      ),
    ])
    return typeof text === 'string' && text.trim() !== '' ? text : fallback
  } catch {
    return fallback
  }
}
