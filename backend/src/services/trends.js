// Real Google Trends data — free, no API key, no signup required. Uses the
// same unofficial data layer Google Trends' own website runs on. Since it's
// unofficial (Google has no public Trends API), it can occasionally fail or
// get rate-limited under heavy use — every call here is wrapped so a Trends
// hiccup never breaks the rest of the app.
const googleTrends = require("google-trends-api");

async function getInterestOverTime(keyword, geo) {
  const raw = await googleTrends.interestOverTime({ keyword, geo: geo || "" });
  const parsed = JSON.parse(raw);
  const timeline = parsed?.default?.timelineData || [];

  return timeline.slice(-12).map((point) => ({
    date: point.formattedAxisTime,
    value: point.value?.[0] ?? 0,
  }));
}

async function getRelatedQueries(keyword, geo) {
  const raw = await googleTrends.relatedQueries({ keyword, geo: geo || "" });
  const parsed = JSON.parse(raw);
  const ranked = parsed?.default?.rankedList || [];

  const top = (ranked[0]?.rankedKeyword || []).slice(0, 5).map((k) => k.query);
  const rising = (ranked[1]?.rankedKeyword || []).slice(0, 5).map((k) => k.query);

  return { top, rising };
}

// Real interest-by-region data — shows which cities/regions within a
// country search this term most, using Google's own regional breakdown.
// This is what powers Local SEO: understanding where demand actually is.
async function getInterestByRegion(keyword, geo) {
  const raw = await googleTrends.interestByRegion({ keyword, geo: geo || "", resolution: geo ? "REGION" : "COUNTRY" });
  const parsed = JSON.parse(raw);
  const rows = parsed?.default?.geoMapData || [];

  return rows
    .filter((r) => r.value && r.value[0] > 0)
    .sort((a, b) => b.value[0] - a.value[0])
    .slice(0, 10)
    .map((r) => ({ name: r.geoName, value: r.value[0] }));
}

async function getKeywordTrends(keyword, geo) {
  const [interestOverTime, relatedQueries] = await Promise.allSettled([
    getInterestOverTime(keyword, geo),
    getRelatedQueries(keyword, geo),
  ]);

  return {
    keyword,
    geo: geo || "",
    interestOverTime: interestOverTime.status === "fulfilled" ? interestOverTime.value : [],
    relatedQueries: relatedQueries.status === "fulfilled" ? relatedQueries.value : { top: [], rising: [] },
  };
}

module.exports = { getKeywordTrends, getInterestByRegion };
