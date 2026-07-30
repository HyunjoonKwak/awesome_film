import { describe, expect, it } from "vitest";
import { BLEND_MODES, isBackdropBlend, type BlendMode } from "../clip";

// The renderer picks one of two completely different code paths from this
// predicate, so what matters is that it classifies *every* declared mode and
// that neither bucket is accidentally empty.
describe("isBackdropBlend", () => {
  const FIXED_FUNCTION: readonly BlendMode[] = ["normal", "multiply", "screen", "add"];

  it("classifies every declared blend mode", () => {
    const backdrop = BLEND_MODES.filter((m) => isBackdropBlend(m));
    const fixed = BLEND_MODES.filter((m) => !isBackdropBlend(m));
    expect([...backdrop, ...fixed].sort()).toEqual([...BLEND_MODES].sort());
    expect(backdrop.length + fixed.length).toBe(BLEND_MODES.length);
  });

  it("routes exactly the fixed-function modes away from the shader path", () => {
    expect(BLEND_MODES.filter((m) => !isBackdropBlend(m)).sort()).toEqual(
      [...FIXED_FUNCTION].sort(),
    );
  });

  it("sends every other mode to the shader path", () => {
    for (const mode of BLEND_MODES) {
      if (FIXED_FUNCTION.includes(mode)) continue;
      expect(isBackdropBlend(mode), `${mode} should read the backdrop`).toBe(true);
    }
  });

  it("treats undefined as normal", () => {
    expect(isBackdropBlend(undefined)).toBe(false);
  });

  // Project files are validated with a passthrough schema, so a mode saved by a
  // newer build reaches the renderer as an unknown string. It must fall back to
  // the blit path rather than index the shader's mode table out of range.
  it("rejects unknown modes instead of routing them to the shader", () => {
    expect(isBackdropBlend("plasma" as BlendMode)).toBe(false);
    expect(isBackdropBlend("" as BlendMode)).toBe(false);
  });

  it("has no duplicate entries", () => {
    expect(new Set(BLEND_MODES).size).toBe(BLEND_MODES.length);
  });
});
