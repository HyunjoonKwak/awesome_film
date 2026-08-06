// Pure YouTube watch-page credit extraction — no Electron imports so it
// stays unit-testable with plain `node --test`. The IPC glue (fetch,
// handler registration) lives in main.cjs. The renderer feeds the returned
// text into its existing description-credits parser.

const ALLOWED_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const isAllowedYoutubeUrl = (raw) => {
  try {
    const u = new URL(String(raw));
    return (u.protocol === "https:" || u.protocol === "http:") && ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

// Slice the balanced JSON object that follows `marker` in the page source.
// Watch pages embed huge JSON blobs (`var ytInitialData = {...};`) that a
// regex cannot delimit reliably — walk braces with string awareness.
const extractJsonAfter = (html, marker) => {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      if (inString) escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
};

const textOf = (node) => {
  if (!node || typeof node !== "object") return "";
  if (typeof node.simpleText === "string") return node.simpleText;
  if (Array.isArray(node.runs)) return node.runs.map((r) => r?.text ?? "").join("");
  return "";
};

// The structured "Music in this video" panel is built from infoRowRenderer
// nodes (SONG / ARTIST / ALBUM / LICENSES). Their exact nesting shifts with
// YouTube experiments, so scan the whole tree for the renderer by name.
// NOTE: current YouTube lazy-loads that panel via /youtubei/v1/next, so on
// most pages this finds nothing and the description (below) is the
// practical path — kept as best-effort for variants that inline the rows.
const collectInfoRows = (node, out) => {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) collectInfoRows(child, out);
    return;
  }
  const row = node.infoRowRenderer;
  if (row && typeof row === "object") {
    const label = textOf(row.title);
    const value = textOf(row.defaultMetadata) || textOf(row.expandedMetadata);
    if (label && value) out.push(label, value);
  }
  for (const value of Object.values(node)) collectInfoRows(value, out);
};

const extractMusicRows = (html) => {
  const data = extractJsonAfter(html, "ytInitialData");
  if (!data) return [];
  const out = [];
  collectInfoRows(data, out);
  return out;
};

const extractDescription = (html) => {
  const player = extractJsonAfter(html, "ytInitialPlayerResponse");
  const description = player?.videoDetails?.shortDescription;
  return typeof description === "string" ? description : "";
};

// Everything the renderer's credits parser can chew on: the structured
// music rows first (label/value per line), then the raw description.
const creditsTextFromWatchHtml = (html) => {
  const rows = extractMusicRows(html);
  const description = extractDescription(html);
  const text = [rows.join("\n"), description].filter(Boolean).join("\n\n");
  return text || null;
};

module.exports = {
  isAllowedYoutubeUrl,
  extractJsonAfter,
  extractMusicRows,
  extractDescription,
  creditsTextFromWatchHtml,
};
