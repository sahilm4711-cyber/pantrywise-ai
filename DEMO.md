# PantryWise AI — demo script (Round 2 build round)

A 90-second judge walkthrough. Every number below is reproducible from the
seeded demo data; nothing on screen is hand-waved.

## Setup (before the judges arrive)

```bash
git clone https://github.com/sahilm4711-cyber/pantrywise-ai.git
cd pantrywise-ai
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). If the port is
busy, Vite prints the next free one — use that URL.

## The walkthrough

### 1. Load the demo data (Inventory tab, 10 seconds)

Click **Inventory → Load demo data** and accept the confirmation.

Say: "A synthetic family-of-four household — 40 items across all 9
categories, plus a 5-item shopping list. It is labelled synthetic, and the
dates are relative to today, so this demo works any day."

### 2. Dashboard: the headline (20 seconds)

Point at **At a glance**: 40 active items, 13 needing attention, 4
duplicate alerts, 1.5 recorded consumed.

Point at **Top 3 Use Soon**: Dal (cooked), Spinach, Methi — all scoring 86.
Say: "The top 3 are identifiable at a glance — that is the usability bar
we built for."

### 3. One Use Soon card, explained (20 seconds)

Open the **Use Soon** list and pick **Milk — High · 84**.

Say: "Milk expires in 1 day, and with 0.5 L a day of use, 1.5 of its 2 litres
— 75% — will still be here at expiry. Score = 0.6 × urgency + 0.4 × excess
= 0.6 × 90 + 0.4 × 75 = 84. Every card shows its reason chips and the facts
behind them — no black box."

Then point at **Tomatoes**: "Expiry estimated — purchase date plus the
6-day fruit prior, always labelled estimated, never shown as known." And
**Salt** under Needs information: "No dates at all, so the system refuses
to score it instead of inventing one."

### 4. Act on it live (20 seconds)

On the **Inventory** tab, log 0.5 L of Milk as **Used**.

Say: "The score moves 84 → 81, still High, and the recorded-consumed total
moves 1.5 → 2.0 — same render, no reload."

Then log the rest as **Discarded**: "Active items drop 40 → 39, discarded
rises by exactly that quantity. Recorded history and score projections are
kept separate."

### 5. Shopping list (20 seconds)

On the **Shopping List** tab, read the five recommendations:

| List item | Recommendation | Why |
|---|---|---|
| Milk | Use soon | Already in stock, scoring 84 |
| Bread pack | Buy less (0) | Variant of Bread; 4 days stocked |
| Rice | Skip duplicate | 20 days stocked |
| Bananas | Use soon | Scoring 72 — urgency beats the Buy-less band |
| Oats | Keep on list | Not in inventory |

Say: "Bananas is the interesting one — it is partially stocked, but its
score of 72 triggers Use soon first, per the rule table's order. Fuzzy
matches like a typo never auto-act; they go to Review data."

Close with: "Edit any inventory quantity and the recommendations update
immediately — try it."

## Spec anchors (if asked)

- Formula: `RiskScore = round(0.6 × U + 0.4 × E)`; bands High ≥ 70,
  Medium 40–69, Low < 40. Milk = 84, High.
- Duplicate threshold: Levenshtein similarity ≥ 0.85. Fixture set: 60
  pairs, 100% precision / 100% recall (required: 90% / 85%).
- Cover thresholds: Skip ≥ 7 days, Buy less 3–7 days, Keep < 3 days.
- Latency: 200-item recompute < 500 ms; first render < 2 s (local,
  no backend calls — everything is localStorage).
- Tests: `npm test` — 127 node:test tests, zero dependencies added.

## Honesty notes (for Q&A — do not overclaim)

- The scorer is a deterministic expert system, not a machine-learning
  model. The learning loop is a counted rate from logged events.
- Shelf-life priors are the submitted v1.3 values, including the ones
  later research questioned (bread 4 days, dry staples 180 days). The
  build follows the submitted spec; changing them is a spec decision.
- Waste-reduction percentages are pilot targets to test, not measured
  results. No study of a commercial reminder app proves them.
- Explanations are templates built from scored facts. The optional LLM
  endpoint is a hook, not a dependency — the app never needs it.
- No account, no cloud, no subscription: data lives in the browser.

## If something goes wrong

- Numbers look stale or odd → **Inventory → Clear all → Load demo data**.
  That restores the exact seeded state.
- App will not start → `npm install`, then `npm run dev` again.
- A page looks empty → check the tab (Dashboard / Inventory / Shopping
  List / Insights / Import) — each tab owns one part of the flow above.
- Saved data damaged → the app shows a banner and starts empty rather
  than crashing. Reload demo data to continue.

## P0 checklist (FR-01–FR-09, all demoed above)

| FR | Where it shows | Evidence |
|---|---|---|
| FR-01 Inventory CRUD | Inventory tab | Add/edit/delete + validation errors |
| FR-02 Risk ranking | Dashboard, ranked list | 39 scored, sorted, < 500 ms |
| FR-03 Use Soon | Dashboard, Top 3 + list | Exactly the 6 items scoring ≥ 70 |
| FR-04 Duplicates | Shopping tab | 60-pair fixture, 100% / 100% |
| FR-05 Recommendations | Shopping tab | All 5 seed cases + reason codes |
| FR-06 Dashboard metrics | At a glance | 40 / 13 / 4 / 1.5 / 0 |
| FR-07 Demo dataset | Load demo data | 40 items, 5 list items, 9 categories |
| FR-08 Expiry estimation | Tomatoes card | "Estimated (prior)", never as known |
| FR-09 Learning loop | Curd card | "Learned (3 events)", 0.5/day |

## Beyond P0 (FR-10–FR-17, all built)

Use these only if the judges ask "what came after P0" — the 90-second
script above still stands on its own.

| FR | Demo moment (30 seconds each) |
|---|---|
| FR-10 Confidence labels | Every scored card shows High confidence or Partial from its provenance; **Salt** under Needs information now reads "Insufficient". |
| FR-11 Historical insights | **Insights** tab: on the seed it shows the empty state (3 events). Log 2 more Used/Discarded events and the trends appear — totals plus a per-category table. |
| FR-12 Export/restore | **Inventory → Export JSON**, then **Clear all**, then **Import JSON** with that file: items, events, and list come back exactly. |
| FR-13 Receipt-ready model | Not demoed alone — it shows through FR-16: imported lines keep their retailer `externalId`, which is what makes the dedup work. |
| FR-14 Receipt import | **Import** tab → **Use sample receipt → Parse receipt**: 6 items, with Bread's unit flagged. Fill the flagged units, **Confirm**, and all 6 land in inventory (left blank, those lines are skipped and counted). |
| FR-15 Household sharing | **Insights → Household**: add a member, set them active, log an event on Inventory — the member table attributes it to them. On-device only: no cross-device sync, which the PRD leaves out of scope. |
| FR-16 Retailer integration | **Import** tab → **Use sample history → Parse history → Confirm**: 3 items added. Parse the same history again: 1 new, 2 already imported — re-imports never duplicate stock. |
| FR-17 Meal ideas | Do NOT demo this as a feature. The hook is built (top-3 High items, names and quantities only, 3 s timeout), but no endpoint is connected, so the control is hidden by design — exactly as the PRD specifies. |
