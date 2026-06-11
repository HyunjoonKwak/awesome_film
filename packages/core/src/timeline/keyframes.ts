import type { BezierHandles, EasingFn, Keyframe, KeyframeTrack } from "../model/keyframe";
import type { Ms } from "../utils/time";

const easings: Record<Exclude<EasingFn, "bezier">, (t: number) => number> = {
  linear: (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => 1 - (1 - t) * (1 - t),
  "ease-in-out": (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  step: (t) => (t < 1 ? 0 : 1),
};

// Solves a CSS-style cubic-bezier(x1,y1,x2,y2) easing at progress `x`.
// Finds the curve parameter u where Bx(u) = x (Newton-Raphson with a
// bisection fallback), then returns By(u).
export const cubicBezier = (h: BezierHandles, x: number): number => {
  const [x1, y1, x2, y2] = h;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bx = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u;
  };
  const by = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
  };
  const dbx = (u: number) => {
    const v = 1 - u;
    return 3 * v * v * x1 + 6 * v * u * (x2 - x1) + 3 * u * u * (1 - x2);
  };
  let u = x;
  for (let i = 0; i < 8; i++) {
    const err = bx(u) - x;
    if (Math.abs(err) < 1e-5) return by(u);
    const d = dbx(u);
    if (Math.abs(d) < 1e-6) break;
    u -= err / d;
  }
  // Bisection fallback when Newton stalls.
  let lo = 0;
  let hi = 1;
  u = x;
  for (let i = 0; i < 24; i++) {
    const err = bx(u) - x;
    if (Math.abs(err) < 1e-5) break;
    if (err > 0) hi = u;
    else lo = u;
    u = (lo + hi) / 2;
  }
  return by(u);
};

const easeAt = (kf: Keyframe, t: number): number => {
  if (kf.easing === "bezier" && kf.bezier) return cubicBezier(kf.bezier, t);
  return (easings[kf.easing as Exclude<EasingFn, "bezier">] ?? easings.linear)(t);
};

// Sample a single keyframe track at a clip-relative time. Returns null if
// the track is empty; clamps before the first and after the last keyframe.
export const sampleKeyframeTrack = (track: KeyframeTrack, atMs: Ms): number | null => {
  const kfs = track.keyframes;
  if (kfs.length === 0) return null;
  const first = kfs[0]!;
  if (atMs <= first.at) return first.value;
  const last = kfs[kfs.length - 1]!;
  if (atMs >= last.at) return last.value;

  // Binary search would be nicer for large tracks; linear is fine for now.
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]!;
    const b = kfs[i + 1]!;
    if (atMs >= a.at && atMs <= b.at) {
      const span = b.at - a.at;
      const t = span > 0 ? (atMs - a.at) / span : 1;
      const eased = easeAt(a, t);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return last.value;
};

// Sample all tracks on a clip into a path -> value record. Consumers map
// these back onto effect params / transforms.
export const sampleKeyframes = (
  tracks: readonly KeyframeTrack[],
  atMs: Ms,
): Readonly<Record<string, number>> => {
  const out: Record<string, number> = {};
  for (const t of tracks) {
    const v = sampleKeyframeTrack(t, atMs);
    if (v !== null) out[t.target] = v;
  }
  return out;
};

// Insert/replace a keyframe at a given time on a track. Returns the new
// keyframe array; out-of-order inserts get sorted.
export const upsertKeyframe = (
  track: KeyframeTrack,
  kf: Keyframe,
): readonly Keyframe[] => {
  const exists = track.keyframes.findIndex((k) => k.at === kf.at);
  const next = [...track.keyframes];
  if (exists >= 0) next[exists] = kf;
  else next.push(kf);
  return next.sort((a, b) => a.at - b.at);
};
