import { describe, expect, it, vi } from "vitest";
import { MAX_FRAMES_PER_ASSET, VideoFrameCache } from "../video-frame-cache";

// Minimal VideoFrame stub for jsdom — only the fields the cache touches.
const stubFrame = (timestamp: number) =>
  ({
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

  it("rejects a nearest frame outside the requested tolerance", () => {
    const c = new VideoFrameCache();
    c.store("a", stubFrame(2_000_000));
    expect(c.nearest("a", 0, 100_000)).toBeNull();
    expect(c.nearest("a", 1_950_000, 100_000)?.timestampUs).toBe(2_000_000);
  });

  it("evicts the oldest entry past the per-asset limit", () => {
    const c = new VideoFrameCache();
    for (let i = 0; i < MAX_FRAMES_PER_ASSET + 6; i++) c.store("a", stubFrame(i * 1000));
    // Earliest frames should be gone.
    expect(c.nearest("a", 0)?.timestampUs).not.toBe(0);
  });

  it("keeps a recently read frame when the per-asset LRU is full", () => {
    const c = new VideoFrameCache();
    for (let i = 0; i < MAX_FRAMES_PER_ASSET; i++) c.store("a", stubFrame(i * 1000));
    // Touch frame 0 so it becomes most-recently-used.
    expect(c.nearest("a", 0)?.timestampUs).toBe(0);

    // One more store overflows the cap and evicts the now-oldest (1000), not 0.
    c.store("a", stubFrame(MAX_FRAMES_PER_ASSET * 1000));
    expect(c.nearest("a", 0)?.timestampUs).toBe(0);
    expect(c.nearest("a", 1000)?.timestampUs).not.toBe(1000);
  });

  it("does not evict one asset's frames when another asset overflows", () => {
    const c = new VideoFrameCache();
    c.store("b", stubFrame(500_000));
    // Fill asset "a" well past its cap.
    for (let i = 0; i < MAX_FRAMES_PER_ASSET + 10; i++) c.store("a", stubFrame(i * 1000));
    // "b" survives because the cap is per-asset, not a shared global pool.
    expect(c.nearest("b", 500_000)?.timestampUs).toBe(500_000);
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
