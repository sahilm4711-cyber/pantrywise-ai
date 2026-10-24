// Category shelf-life priors (days) — PRD v1.3 §6.3, VisionX build copy
// (the version submitted for Round 1). Editable defaults: an estimated
// expiry is purchaseDate + prior, labelled "Estimated (prior)".
// NOTE: These are the SUBMITTED v1.3 values. The later v1.4 research pass
// found several of them off against USDA ranges, but v1.3 is locked and
// submitted, so the build follows v1.3 exactly. Do not "fix" these values
// without a spec change agreed by the team.
export const SHELF_LIFE_PRIORS_DAYS = {
  'Cooked food': 2,
  'Leafy vegetables': 3,
  Bread: 4,
  'Milk / dairy': 5,
  Fruits: 6,
  Eggs: 21,
  'Root vegetables': 14,
  'Packaged snacks': 90,
  'Dry staples (rice, pulses, flour)': 180,
}

/** Prior in days for a category, or null when the category is unknown. */
export function getShelfLifePrior(category) {
  return Object.prototype.hasOwnProperty.call(SHELF_LIFE_PRIORS_DAYS, category)
    ? SHELF_LIFE_PRIORS_DAYS[category]
    : null
}
