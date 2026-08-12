// Real website audit data via Google's PageSpeed Insights API.
// Free to use. Works without an API key at a low rate limit; set
// GOOGLE_PAGESPEED_API_KEY in .env for higher limits (also free, from
// Google Cloud Console — see README "Real SEO audit data").
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];

function normalizeUrl(domain) {
  if (/^https?:\/\//i.test(domain)) return domain;
  return `https://${domain}`;
}

async function runPageSpeedAudit(domain) {
  const url = normalizeUrl(domain);
  const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;

  const params = new URLSearchParams({ url, strategy: "mobile" });
  CATEGORIES.forEach((c) => params.append("category", c));
  if (apiKey) params.set("key", apiKey);

  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let res;
  try {
    res = await fetch(endpoint, { signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("The audit took too long to run. Try again — some sites are slower to analyze than others.");
    }
    throw new Error("Couldn't reach Google's audit service. Check your internet connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message || `PageSpeed API returned ${res.status}`;
    throw new Error(`Couldn't audit that site: ${message}`);
  }

  const data = await res.json();
  const categories = data?.lighthouseResult?.categories || {};
  const audits = data?.lighthouseResult?.audits || {};

  const categoryScores = CATEGORIES.map((c) => categories[c]?.score).filter((s) => typeof s === "number");
  const healthScore = categoryScores.length
    ? Math.round((categoryScores.reduce((a, b) => a + b, 0) / categoryScores.length) * 100)
    : 0;

  let criticalIssues = 0;
  let warnings = 0;
  let notices = 0;
  let passedChecks = 0;
  const topIssues = [];

  for (const audit of Object.values(audits)) {
    if (audit.scoreDisplayMode === "notApplicable") continue;

    if (audit.scoreDisplayMode === "informative" || audit.scoreDisplayMode === "manual") {
      notices++;
      continue;
    }

    if (typeof audit.score !== "number") continue;

    if (audit.score === 1) {
      passedChecks++;
    } else if (audit.score < 0.5) {
      criticalIssues++;
      topIssues.push({ title: audit.title, score: audit.score });
    } else {
      warnings++;
      topIssues.push({ title: audit.title, score: audit.score });
    }
  }

  topIssues.sort((a, b) => a.score - b.score);

  return {
    healthScore,
    criticalIssues,
    warnings,
    notices,
    passedChecks,
    topIssues: topIssues.slice(0, 10),
    categoryScores: {
      performance: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
      accessibility: categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null,
      bestPractices: categories["best-practices"]?.score != null ? Math.round(categories["best-practices"].score * 100) : null,
      seo: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null,
    },
  };
}

module.exports = { runPageSpeedAudit };
