// Real sitemap.xml and robots.txt checks — a plain HTTP fetch, no paid API
// needed. Checks presence and basic validity, and flags the common
// "robots.txt accidentally blocks everything" mistake.
async function checkTechnicalSeo(domain) {
  const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  const result = {
    sitemapFound: false,
    sitemapUrl: `${baseUrl}/sitemap.xml`,
    robotsFound: false,
    robotsUrl: `${baseUrl}/robots.txt`,
    robotsBlocksAll: false,
  };

  try {
    const sitemapRes = await fetch(result.sitemapUrl, { method: "GET" });
    result.sitemapFound = sitemapRes.ok;
  } catch {
    result.sitemapFound = false;
  }

  try {
    const robotsRes = await fetch(result.robotsUrl, { method: "GET" });
    result.robotsFound = robotsRes.ok;
    if (robotsRes.ok) {
      const text = await robotsRes.text();
      // A bare "Disallow: /" under a wildcard user-agent blocks the whole
      // site from being crawled — a common, serious, easy-to-miss mistake.
      result.robotsBlocksAll = /user-agent:\s*\*[\s\S]{0,100}?disallow:\s*\/\s*$/im.test(text);
    }
  } catch {
    result.robotsFound = false;
  }

  return result;
}

module.exports = { checkTechnicalSeo };
