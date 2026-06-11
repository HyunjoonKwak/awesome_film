import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { newId } from "../../utils/id";
import { magneticMove, resolvePlacement } from "../collide";

const clip = (start: number, duration: number): MediaClip => ({
  kind: "media",
  id: newId(),
  assetId: newId(),
  start,
  duration,
  trimIn: 0,
  trimOut: duration,
  speed: 1,
  effects: [],
  keyframes: [],
});

describe("resolvePlacement", () => {
  it("returns the candidate unchanged on an empty track", () => {
    expect(resolvePlacement([], 1000, 500)).toBe(500);
  });

  it("never returns a negative start", () => {
    expect(resolvePlacement([], 1000, -200)).toBe(0);
  });

  it("keeps a non-overlapping candidate as-is", () => {
    const clips = [clip(0, 1000), clip(3000, 1000)];
    expect(resolvePlacement(clips, 500, 1500)).toBe(1500);
  });

  it("clamps a candidate that would overlap the next clip", () => {
    const clips = [clip(2000, 1000)];
    // 1000ms clip dropped at 1500 would overlap [2000,3000] → clamp to 1000.
    expect(resolvePlacement(clips, 1000, 1500)).toBe(1000);
  });

  it("clamps a candidate that would overlap the previous clip", () => {
    const clips = [clip(0, 1000)];
    // Dropped at 500 overlapping [0,1000] → pushed right to 1000.
    expect(resolvePlacement(clips, 1000, 500)).toBe(1000);
  });

  it("rejects a gap smaller than the clip and picks the nearest fitting spot", () => {
    const clips = [clip(0, 1000), clip(1400, 1000)];
    // The 400ms gap can't host a 1000ms clip; nearest valid start is after
    // the second clip (2400) rather than inside the gap.
    expect(resolvePlacement(clips, 1000, 1100)).toBe(2400);
  });

  it("excludes the clip being moved from collision checks", () => {
    const moving = clip(0, 1000);
    const clips = [moving, clip(2000, 1000)];
    // Moving its own body within free space must not self-collide.
    expect(resolvePlacement(clips, 1000, 600, moving.id)).toBe(600);
  });

  it("snaps into the exact gap when the candidate sits inside it", () => {
    const clips = [clip(0, 1000), clip(2000, 1000)];
    // Gap [1000,2000] fits a 1000ms clip only at start=1000.
    expect(resolvePlacement(clips, 1000, 1200)).toBe(1000);
  });
});

describe("magneticMove", () => {
  const starts = (clips: readonly { start: number }[]) =>
    clips.map((c) => c.start).sort((a, b) => a - b);

  it("moves freely when nothing overlaps", () => {
    const m = clip(0, 1000);
    const next = magneticMove([m, clip(5000, 1000)], m.id, 2000);
    expect(next.find((c) => c.id === m.id)?.start).toBe(2000);
    expect(starts(next)).toEqual([2000, 5000]);
  });

  it("pushes a downstream clip out of the way", () => {
    const m = clip(0, 1000);
    const other = clip(1500, 1000);
    const next = magneticMove([m, other], m.id, 1200);
    // M lands at 1200..2200, so the neighbour is pushed to 2200.
    expect(next.find((c) => c.id === m.id)?.start).toBe(1200);
    expect(next.find((c) => c.id === other.id)?.start).toBe(2200);
  });

  it("cascades pushes through several clips", () => {
    const m = clip(0, 1000);
    const a = clip(1000, 500);
    const b = clip(1500, 500);
    const next = magneticMove([m, a, b], m.id, 1200);
    expect(next.find((c) => c.id === m.id)?.start).toBe(1200);
    expect(next.find((c) => c.id === a.id)?.start).toBe(2200);
    expect(next.find((c) => c.id === b.id)?.start).toBe(2700);
  });

  it("clamps against an overlapping left neighbour instead of pushing it", () => {
    const left = clip(0, 1000);
    const m = clip(3000, 500);
    const next = magneticMove([left, m], m.id, 500);
    // Target 500 lands inside [0,1000] → clamp to 1000; left stays put.
    expect(next.find((c) => c.id === m.id)?.start).toBe(1000);
    expect(next.find((c) => c.id === left.id)?.start).toBe(0);
  });

  it("never moves to a negative start", () => {
    const m = clip(2000, 500);
    const next = magneticMove([m], m.id, -300);
    expect(next.find((c) => c.id === m.id)?.start).toBe(0);
  });

  it("returns clips sorted by start", () => {
    const m = clip(0, 1000);
    const other = clip(2000, 500);
    const next = magneticMove([m, other], m.id, 4000);
    expect(starts(next)).toEqual([2000, 4000]);
    expect(next[0]?.id).toBe(other.id);
  });
});
