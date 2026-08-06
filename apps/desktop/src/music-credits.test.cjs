const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isAllowedYoutubeUrl,
  extractJsonAfter,
  extractMusicRows,
  extractDescription,
  creditsTextFromWatchHtml,
} = require("./music-credits.cjs");

test("isAllowedYoutubeUrl accepts YouTube hosts only", () => {
  assert.equal(isAllowedYoutubeUrl("https://www.youtube.com/watch?v=x"), true);
  assert.equal(isAllowedYoutubeUrl("https://youtu.be/x"), true);
  assert.equal(isAllowedYoutubeUrl("https://evil.com/watch?v=x"), false);
  assert.equal(isAllowedYoutubeUrl("file:///etc/passwd"), false);
  assert.equal(isAllowedYoutubeUrl(null), false);
});

test("extractJsonAfter slices a balanced object with strings containing braces", () => {
  const html = 'junk var data = {"a":"tricky } brace","b":{"c":1}};more';

  assert.deepEqual(extractJsonAfter(html, "var data ="), {
    a: "tricky } brace",
    b: { c: 1 },
  });
  assert.equal(extractJsonAfter(html, "missing"), null);
});

const watchHtml = `
<html><script>var ytInitialPlayerResponse = {"videoDetails":{"shortDescription":"Best vlog!\\nMusic: Kevin MacLeod - Monkeys"}};</script>
<script>var ytInitialData = {"panels":[{"whatever":{"infoRowRenderer":{"title":{"simpleText":"SONG"},"defaultMetadata":{"simpleText":"Fly Away"}}}},{"x":{"infoRowRenderer":{"title":{"simpleText":"ARTIST"},"defaultMetadata":{"runs":[{"text":"TheFatRat"}]}}}}]};</script></html>
`;

test("extracts structured music rows from ytInitialData", () => {
  assert.deepEqual(extractMusicRows(watchHtml), ["SONG", "Fly Away", "ARTIST", "TheFatRat"]);
});

test("extracts the description from ytInitialPlayerResponse", () => {
  assert.match(extractDescription(watchHtml), /Best vlog!/);
});

test("creditsTextFromWatchHtml combines rows and description, null when empty", () => {
  const text = creditsTextFromWatchHtml(watchHtml);
  assert.match(text, /SONG\nFly Away/);
  assert.match(text, /Kevin MacLeod/);
  assert.equal(creditsTextFromWatchHtml("<html>nothing here</html>"), null);
});
