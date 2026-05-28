import { describe, expect, it, vi } from "vitest";
import { VideoFrameCache } from "../video-frame-cache";

// Minimal VideoFrame stub for jsdom — only the fields the cache touches.
const stubFrame = (timestamp: number) => ({
  timestamp,
  close: vi.fn(),
}) as unknown as VideoFrame;

describe("VideoFrameCache", () => {
  it("stores and recalls the nearest frame", () => {
    const c = new VideoFrameCache();
    c.store("a", stubFrame(1_000_000));
    c.store("a", stubFrame(2_000_000));
    c.store("a", stubFrame(3_000_000));
    const near = c.nearest("a", 2_400_000);
    expect(near?.timestampUs).toBe(2_000_000);
  });

  it("returns null for unknown asset", () => {
    const c = new VideoFrameCache();
    c.store("a", stubFrame(0));
    expect(c.nearest("b", 0)).toBeNull();
  });

  it("evicts the oldest entry past the limit", () => {
    const c = new VideoFrameCache();
    for (let i = 0; i < 30; i++) c.store("a", stubFrame(i * 1000));
    // Earliest frames should be gone.
    expect(c.nearest("a", 0)?.timestampUs).not.toBe(0);
  });

  it("forget releases all frames for one asset", () => {
    const c = new VideoFrameCache();
    const f = stubFrame(0);
    c.store("a", f);
    c.forget("a");
    expect(c.nearest("a", 0)).toBeNull();
    expect(f.close).toHaveBeenCalled();
  });
});
