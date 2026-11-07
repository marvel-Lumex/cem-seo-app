const RULES = [
  ["contrast", "Some text is hard to read because its color is too close to the background. Change the text or background color so everyone can read it, including people with weak eyesight."],
  ["forced reflow", "The page does extra layout work that makes it feel slow. Ask your developer to avoid measuring page sizes right after changing the page in scripts."],
  ["unused javascript", "The page downloads code it does not use, which slows loading. Remove or delay scripts that are not needed when the page first opens."],
  ["unused css", "The page loads styling it does not use, which slows loading. Remove styles that are not needed."],
  ["explicit width and height", "Images without set sizes make the page jump around while it loads. Add a width and height to each image."],
  ["largest contentful paint", "This is how long the main content takes to appear. A slow time makes visitors wait. Compress the biggest image and speed up the server to improve it."],
  ["first contentful paint", "This is how long before anything appears on screen. Smaller files and faster hosting improve it."],
  ["max potential first input delay", "This estimates how long the page may feel frozen after it loads. Reduce heavy scripts to improve it."],
  ["time to interactive", "This is how long until the page responds to taps and clicks. Fewer and smaller scripts make it faster."],
  ["total blocking time", "This is the time the page is frozen while scripts run. Split or remove heavy scripts to improve it."],
  ["cumulative layout shift", "Content jumps around while the page loads. Reserve space for images, ads and banners so nothing shifts."],
  ["speed index", "This shows how quickly the page looks complete as it loads. Smaller images and fewer scripts improve it."],
  ["render-blocking", "Some files must finish loading before the page can show. Delay or inline them so the page appears sooner."],
  ["next-gen", "Images are in older formats. Convert them to WebP or AVIF to make the page lighter and faster."],
  ["properly size images", "Images are larger than they need to be. Resize them to the size they are shown at."],
  ["efficiently encode images", "Images can be compressed more without losing quality. Compress them to speed up loading."],
  ["text compression", "Text files are sent uncompressed. Turn on compression (gzip or Brotli) on the server."],
  ["minify", "Code files contain extra spaces and comments. Minify them to make them smaller."],
  ["server response", "The server takes too long to respond. Better hosting or caching will help."],
  ["meta description", "The page has no short description for search results. Add a clear meta description."],
  ["title", "The page title is missing or weak. Add a clear, unique title that describes the page."],
  ["alt", "Some images have no text description. Add alt text so search engines and screen readers understand them."],
  ["tap targets", "Buttons or links are too small or too close together on phones. Make them larger with more space between."],
  ["font size", "Some text is too small to read on phones. Increase the font size."],
  ["viewport", "The page is not set up for phone screens. Add a mobile viewport setting."],
  ["crawl", "Search engines may be blocked from reading this page. Check your robots settings."],
  ["redirect", "Visitors are sent through extra redirects before reaching the page. Link directly to the final address."]
];

function explainFor(title) {
  const t = String(title || "").toLowerCase();
  for (const [key, text] of RULES) {
    if (t.includes(key)) return text;
  }
  return "";
}

module.exports = { explainFor };
