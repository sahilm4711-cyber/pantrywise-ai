# PantryWise AI

Household grocery intelligence for Triwizathon 2026 (Problem Statement 5 —
Grocery Intelligence & Food Waste Management). PantryWise AI maintains a
household inventory, ranks items by waste risk with a deterministic score,
flags duplicate planned purchases, and recommends one concrete action with a
traceable reason.

## Source of truth

**PRD v1.3 (VisionX build copy) — the version submitted for Round 1.**
Do not silently change defined formulas, thresholds, data fields, or
acceptance criteria. If a requirement conflicts with the code, explain the
conflict before making a breaking change.

Key spec anchors (from the PRD):

- Risk score: `RiskScore = round(0.6 × U + 0.4 × E)`, bands High ≥ 70,
  Medium 40–69, Low &lt; 40. Worked example: Milk scores **84, High**.
- Duplicate detection: Levenshtein similarity ≥ **0.85** → "probable
  duplicate — review".
- Persistence: `localStorage` only. No account, no sync, no subscription.
- Demo data: the 40-item synthetic household + 5-item shopping list
  (FR-07) lands with the inventory module.

## Tech

React 19 + Vite 8, plain JavaScript. Business logic lives in pure-JS modules
separate from React UI. No LLM dependency for deterministic decisions — the
optional explanation endpoints are P1/P2 stretch, never part of scoring.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build check
npm run preview  # serve the production build
```

Requires Node 20.19+ (the team runs Node 24).

## Build order (Module 0 → 6)

1. **Module 0 — Foundation** (this shell): runnable app, shared repo,
   layout + navigation.
2. **Module 1 — Risk-scoring engine**: pure-JS scorer + tests (Milk = 84,
   urgency bands, zero-quantity unscored, insufficient-data state).
3. **Module 2 — Inventory + persistence**: CRUD, validation, localStorage,
   FR-07 demo seed + reset.
4. **Module 3 — Use Soon + explanations**: sorted risk list, bands,
   contributing factors, provenance labels.
5. **Module 4 — Duplicate detection**: normalization, aliases, fuzzy
   matching (≥ 0.85), shopping-list warnings.
6. **Module 5 — Dashboard + recommendations**: metrics, rule-based
   recommendations with reason codes.
7. **Module 6 — Demo polish**: styling, empty states, final demo path.

A module is done only when its PRD acceptance criteria pass. Report actual
test results, including failures — never claim a feature works unverified.

## Branch workflow

- `main` is the runnable branch. One person owns merges into `main`.
- Work on a branch per module; merge only when that module's tests pass.
- Integrate small changes frequently. Keep a known-good commit you can
  restore if a new change breaks the demo.
