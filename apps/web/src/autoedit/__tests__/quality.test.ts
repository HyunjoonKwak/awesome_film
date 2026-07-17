import { describe, expect, it } from "vitest";
import {
  blurVariance,
  classifyShake,
  estimateShift,
  exposureStats,
  judgeJunk,
  motionDiff,
  type LumaPlane,
} from "../quality";
import { fuseInterest, bestWindow } from "../interest";
import type { FrameSample } from "../types";

const plane = (w: number, h: number, fn: (x: number, y: number) => number): LumaPlane => {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = fn(x, y);
  return { data, w, h };
};

describe("blurVariance", () => {
  it("scores a checkerboard far sharper than a flat plane", () => {
    const sharp = plane(32, 32, (x, y) => ((x + y) % 2 === 0 ? 255 : 0));
    const flat = plane(32, 32, () => 128);
    expect(blurVariance(sharp)).toBeGreaterThan(1000);
    expect(blurVariance(flat)).toBe(0);
  });
});

describe("exposureStats", () => {
  it("flags crushed and blown planes", () => {
    const dark = exposureStats(plane(16, 16, () => 1));
    const bright = exposureStats(plane(16, 16, () => 254));
    expect(dark.low).toBeGreaterThan(0.9);
    expect(bright.high).toBeGreaterThan(0.9);
  });
  it("gradient has rich entropy, flat has none", () => {
    const grad = exposureStats(plane(64, 4, (x) => x * 4));
    const flat = exposureStats(plane(64, 4, () => 100));
    expect(grad.entropy).toBeGreaterThan(4);
    expect(flat.entropy).toBeLessThan(0.1);
  });
});

describe("estimateShift + classifyShake", () => {
  const scene = (offX: number, offY: number) =>
    plane(48, 32, (x, y) => (((x + offX) * 7) % 23) * 5 + (((y + offY) * 5) % 17) * 7);

  it("recovers a known translation", () => {
    const { dx, dy } = estimateShift(scene(0, 0), scene(3, -2));
    expect(dx).toBe(-3);
    expect(dy).toBe(2);
  });

  it("consistent drift = stable/pan, alternating = shake", () => {
    const pan = classifyShake([
      { dx: 3, dy: 0 },
      { dx: 3, dy: 0 },
      { dx: 3, dy: 0 },
    ]);
    const shaky = classifyShake([
      { dx: 6, dy: -5 },
      { dx: -7, dy: 6 },
      { dx: 5, dy: -6 },
    ]);
    expect(pan).toBe("stable");
    expect(["heavy", "reject"]).toContain(shaky);
  });
});

describe("motionDiff", () => {
  it("is zero for identical planes and positive for different ones", () => {
    const a = plane(16, 16, (x) => x * 10);
    const b = plane(16, 16, (x) => 255 - x * 10);
    expect(motionDiff(a, a)).toBe(0);
    expect(motionDiff(a, b)).toBeGreaterThan(0.1);
  });
});

describe("judgeJunk", () => {
  const good = { blurVar: 120, low: 0.02, high: 0.02, entropy: 6 };
  it("passes a clean clip", () => {
    const v = judgeJunk([good, good, good], "stable", 5000);
    expect(v.reasons).toEqual([]);
    expect(v.quality).toBeGreaterThan(0.6);
  });
  it("flags blur, exposure, flatness, shake, too-short", () => {
    expect(judgeJunk([{ ...good, blurVar: 3 }], "stable", 5000).reasons).toContain("blur");
    expect(judgeJunk([{ ...good, low: 0.9 }], "stable", 5000).reasons).toContain("underexposed");
    expect(judgeJunk([{ ...good, high: 0.8 }], "stable", 5000).reasons).toContain("overexposed");
    expect(judgeJunk([{ ...good, entropy: 1 }], "stable", 5000).reasons).toContain("flat");
    expect(judgeJunk([good], "reject", 5000).reasons).toContain("shake");
    expect(judgeJunk([good], "stable", 800).reasons).toContain("too-short");
  });
});

describe("interest fusion", () => {
  const sample = (atMs: number, motion: number, smile = 0): FrameSample => ({
    atMs,
    blurVar: 100,
    exposureLow: 0,
    exposureHigh: 0,
    entropy: 6,
    motion,
    smile,
  });

  it("smiling high-motion beats static frames, quality gates output", () => {
    const samples = [sample(0, 0.1), sample(1000, 0.9, 0.9), sample(2000, 0.2)];
    const hi = fuseInterest(samples, 1);
    const lo = fuseInterest(samples, 0.1);
    expect(hi[1]!).toBeGreaterThan(hi[0]!);
    expect(hi[1]!).toBeGreaterThan(lo[1]!);
  });

  it("bestWindow finds the hottest contiguous run", () => {
    const samples = Array.from({ length: 10 }, (_, i) => sample(i * 1000, i >= 6 ? 0.9 : 0.05));
    const interest = fuseInterest(samples, 1);
    const win = bestWindow(samples, interest, 3000);
    expect(win.startMs).toBeGreaterThanOrEqual(5000);
  });
});
