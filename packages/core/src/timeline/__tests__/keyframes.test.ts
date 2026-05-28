import { describe, expect, it } from "vitest";
import { cubicBezier, sampleKeyframeTrack, upsertKeyframe } from "../keyframes";
import type { KeyframeTrack } from "../../model/keyframe";

const track = (kfs: KeyframeTrack["keyframes"]): KeyframeTrack => ({
  target: "transform.x",
  keyframes: kfs,
});

describe("keyframes", () => {
  it("interpolates linearly between two keyframes", () => {
    const t = track([
      { at: 0, value: 0, easing: "linear" },
      { at: 1000, value: 100, easing: "linear" },
    ]);
    expect(sampleKeyframeTrack(t, 0)).toBe(0);
    expect(sampleKeyframeTrack(t, 500)).toBe(50);
    expect(sampleKeyframeTrack(t, 1000)).toBe(100);
  });

  it("clamps before first and after last keyframe", () => {
    const t = track([
      { at: 100, value: 10, easing: "linear" },
      { at: 200, value: 20, easing: "linear" },
    ]);
    expect(sampleKeyframeTrack(t, 50)).toBe(10);
    expect(sampleKeyframeTrack(t, 999)).toBe(20);
  });

  it("returns null for an empty track", () => {
    expect(sampleKeyframeTrack(track([]), 100)).toBeNull();
  });

  it("upserts in time order", () => {
    const t = track([{ at: 0, value: 0, easing: "linear" }]);
    const next = upsertKeyframe(t, { at: 500, value: 50, easing: "linear" });
    expect(next.map((k) => k.at)).toEqual([0, 500]);
    const replaced = upsertKeyframe({ ...t, keyframes: next }, {
      at: 500,
      value: 80,
      easing: "linear",
    });
    expect(replaced[1]!.value).toBe(80);
  });

  it("applies non-linear easing", () => {
    const t = track([
      { at: 0, value: 0, easing: "ease-in" },
      { at: 1000, value: 100, easing: "ease-in" },
    ]);
    // ease-in at t=0.5 should be 0.25, not 0.5
    expect(sampleKeyframeTrack(t, 500)).toBeCloseTo(25, 5);
  });

  it("solves cubic-bezier easing at the endpoints and a linear curve", () => {
    // A linear bezier (1/3, 1/3, 2/3, 2/3) maps x -> x.
    const linear: [number, number, number, number] = [1 / 3, 1 / 3, 2 / 3, 2 / 3];
    expect(cubicBezier(linear, 0)).toBe(0);
    expect(cubicBezier(linear, 1)).toBe(1);
    expect(cubicBezier(linear, 0.5)).toBeCloseTo(0.5, 3);
  });

  it("applies a custom bezier easing on a keyframe segment", () => {
    // CSS "ease-in"-like curve: slow start.
    const t = track([
      { at: 0, value: 0, easing: "bezier", bezier: [0.42, 0, 1, 1] },
      { at: 1000, value: 100, easing: "bezier", bezier: [0.42, 0, 1, 1] },
    ]);
    // At the midpoint the eased value should be well below the linear 50.
    const mid = sampleKeyframeTrack(t, 500)!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(40);
  });
});
