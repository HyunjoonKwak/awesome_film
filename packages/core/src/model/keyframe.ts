import type { Ms } from "../utils/time";

export type EasingFn =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "step"
  | "bezier";

// CSS-style cubic-bezier control points (P1, P2) with implicit endpoints
// P0 = (0,0) and P3 = (1,1). x components are clamped to [0,1].
export type BezierHandles = readonly [number, number, number, number];

export interface Keyframe {
  readonly at: Ms;             // clip-relative time
  readonly value: number;
  readonly easing: EasingFn;
  readonly bezier?: BezierHandles; // only used when easing === "bezier"
}

export interface KeyframeTrack {
  // Dotted path into the clip or effect params, e.g. "transform.x" or
  // "effects.<id>.intensity". The resolver decodes at apply time.
  readonly target: string;
  readonly keyframes: readonly Keyframe[];
}
