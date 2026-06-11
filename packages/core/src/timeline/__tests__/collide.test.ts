import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { newId } from "../../utils/id";
import { resolvePlacement } from "../collide";

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
