import { describe, expect, it } from "vitest";
import { isYoutubeUrl } from "../youtube-meta";

describe("isYoutubeUrl", () => {
  it("accepts watch, short and music URLs", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYoutubeUrl("https://music.youtube.com/watch?v=abc123")).toBe(true);
    expect(isYoutubeUrl("https://m.youtube.com/watch?v=abc123")).toBe(true);
  });

  it("rejects other hosts and non-http schemes", () => {
    expect(isYoutubeUrl("https://vimeo.com/12345")).toBe(false);
    expect(isYoutubeUrl("https://evil.com/youtube.com/watch?v=x")).toBe(false);
    expect(isYoutubeUrl("javascript:alert(1)")).toBe(false);
    expect(isYoutubeUrl("not a url")).toBe(false);
  });
});
