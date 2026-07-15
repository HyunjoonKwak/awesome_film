import { describe, expect, it } from "vitest";
import type { ID } from "../../utils/id";
import type { TextClip } from "../../model/clip";
import { textAnimAt } from "../text-anim";

// Minimal 2s text clip; 500ms default anim window → intro [0,500),
// outro (1500,2000]. A point at 1000ms sits in neither window.
const textClip = (over: Partial<TextClip> = {}): TextClip => ({
  kind: "text",
  id: "t1" as ID,
  start: 0,
  duration: 2000,
  speed: 1,
  effects: [],
  keyframes: [],
  text: "hi",
  font: "sans-serif",
  size: 48,
  color: "#ffffff",
  animMs: 500,
  ...over,
});

describe("textAnimAt", () => {
  it("leaves transform and charFrac untouched outside any anim window", () => {
    const clip = textClip({ animIn: "slide-up", animOut: "slide-up" });
    const s = textAnimAt(clip, 1000);
    expect(s.charFrac).toBe(1);
    expect(s.transform).toEqual({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
  });

  it("slide-up intro offsets the clip and settles to rest by the window end", () => {
    const clip = textClip({ animIn: "slide-up" });
    expect(textAnimAt(clip, 10).transform.y).toBeGreaterThan(0);
    expect(textAnimAt(clip, 500).transform.y).toBeCloseTo(0, 5);
  });

  // Regression: `dir` was `isIn ? 1 : 1`, so the outro slid the SAME way as
  // the intro (a slide-up outro drifted downward). Intro and outro must offset
  // in opposite directions with equal magnitude.
  it("slide-up intro and outro exit opposite edges (symmetry)", () => {
    const introY = textAnimAt(textClip({ animIn: "slide-up" }), 10).transform.y;
    const outroY = textAnimAt(textClip({ animOut: "slide-up" }), 1990).transform.y;
    expect(introY).toBeGreaterThan(0);
    expect(outroY).toBeLessThan(0);
    expect(Math.sign(introY)).toBe(-Math.sign(outroY));
    expect(Math.abs(introY)).toBeCloseTo(Math.abs(outroY), 5);
  });

  it("slide-down mirrors slide-up (outro drifts the opposite sign)", () => {
    const up = textAnimAt(textClip({ animOut: "slide-up" }), 1990).transform.y;
    const down = textAnimAt(textClip({ animOut: "slide-down" }), 1990).transform.y;
    expect(Math.sign(up)).toBe(-Math.sign(down));
  });

  it("fade ramps opacity during the intro and is full mid-clip", () => {
    const clip = textClip({ animIn: "fade" });
    expect(textAnimAt(clip, 0).transform.opacity).toBeLessThan(1);
    expect(textAnimAt(clip, 1000).transform.opacity).toBe(1);
  });

  it("typewriter reveals characters progressively then completes", () => {
    const clip = textClip({ animIn: "typewriter" });
    expect(textAnimAt(clip, 10).charFrac).toBeLessThan(1);
    expect(textAnimAt(clip, 1000).charFrac).toBe(1);
  });

  it("pop scales up from below 1 during the intro", () => {
    const clip = textClip({ animIn: "pop" });
    expect(textAnimAt(clip, 10).transform.scale).toBeLessThan(1);
    expect(textAnimAt(clip, 1000).transform.scale).toBe(1);
  });
});
