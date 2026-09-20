// Pattern-based search intent classification — no AI/paid API needed. This
// mirrors the standard SEO industry categories (informational, commercial,
// transactional) using clear, explainable keyword patterns rather than a
// black-box model, so the classification is always traceable to a real rule.

const TRANSACTIONAL_PATTERNS = [
  "buy", "price", "pricing", "cheap", "discount", "deal", "coupon",
  "for sale", "order", "purchase", "shop", "near me", "cost of",
];

const COMMERCIAL_PATTERNS = [
  "best", "top", "review", "vs", "versus", "compare", "comparison",
  "alternative", "alternatives",
];

const INFORMATIONAL_PATTERNS = [
  "how", "what", "why", "when", "where", "who", "guide", "tutorial",
  "tips", "examples", "meaning", "definition",
];

function classifyIntent(keyword) {
  const lower = keyword.toLowerCase();

  if (TRANSACTIONAL_PATTERNS.some((p) => lower.includes(p))) return "Transactional";
  if (COMMERCIAL_PATTERNS.some((p) => lower.includes(p))) return "Commercial";
  if (INFORMATIONAL_PATTERNS.some((p) => lower.includes(p))) return "Informational";

  // No clear pattern matched — most likely navigational (looking for a
  // specific brand/site) or a broad/ambiguous term. Labeled honestly as
  // "General" rather than guessing a more specific category.
  return "General";
}

module.exports = { classifyIntent };
