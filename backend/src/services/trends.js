// Real Google Trends data — free, no API key, no signup required. Uses the
// same unofficial data layer Google Trends' own website runs on. Since it's
// unofficial (Google has no public Trends API), it can occasionally fail or
// get rate-limited under heavy use — every call here is wrapped so a Trends
// hiccup never breaks the rest of the app.
const googleTrends = require("google-trends-api");

async function getInterestOverTime(keyword) {
  const raw = await googleTrends.interestOverTime({ keyword, geo: "" });
  const parsed = JSON.parse(raw);
  const timeline = parsed?.default?.timelineData || [];

  // Keep the last ~12 points so a sparkline stays readable on a small screen
  return timeline.slice(-12).map((point) => ({
    date: point.formattedAxisTime,
    value: point.value?.[0] ?? 0,
  }));
}

async function getRelatedQueries(keyword) {
  const raw = await googleTrends.relatedQueries({ keyword, geo: "" });
  const parsed = JSON.parse(raw);
  const ranked = parsed?.default?.rankedList || [];

  const top = (ranked[0]?.rankedKeyword || []).slice(0, 5).map((k) => k.query);
  const rising = (ranked[1]?.rankedKeyword || []).slice(0, 5).map((k) => k.query);

  return { top, rising };
}

async function getKeywordTrends(keyword) {
  const [interestOverTime, relatedQueries] = await Promise.allSettled([
    getInterestOverTime(keyword),
    getRelatedQueries(keyword),
  ]);

  return {
    keyword,
    interestOverTime: interestOverTime.status === "fulfilled" ? interestOverTime.value : [],
    relatedQueries: relatedQueries.status === "fulfilled" ? relatedQueries.value : { top: [], rising: [] },
  };
}

module.exports = { getKeywordTrends };
