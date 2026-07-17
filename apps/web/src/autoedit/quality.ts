import type { JunkReason, ShakeTier } from "./types";

// All metrics operate on a small grayscale plane (e.g. 160×90) so they cost
// sub-millisecond per sample and are trivially unit-testable.

export interface LumaPlane {
  readonly data: Float32Array; // luma 0..255
  readonly w: number;
  readonly h: number;
}

export const toLuma = (img: ImageData): LumaPlane => {
  const { data, width: w, height: h } = img;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    out[i] = 0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!;
  }
  return { data: out, w, h };
};

// Variance of the 3×3 Laplacian — the classic sharpness measure. Higher is
// sharper; typical threshold ~40–120 at this resolution.
export const blurVariance = (p: LumaPlane): number => {
  const { data, w, h } = p;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v =
        4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += v;
      sumSq += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
};

export interface ExposureStats {
  readonly low: number; // crushed fraction
  readonly high: number; // blown fraction
  readonly entropy: number; // histogram entropy in bits (0..8)
}

export const exposureStats = (p: LumaPlane): ExposureStats => {
  const hist = new Float64Array(256);
  const { data } = p;
  for (let i = 0; i < data.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(data[i]!)));
    hist[v]!++;
  }
  const total = data.length || 1;
  let low = 0;
  let high = 0;
  for (let v = 0; v <= 5; v++) low += hist[v]!;
  for (let v = 250; v <= 255; v++) high += hist[v]!;
  let entropy = 0;
  for (let v = 0; v < 256; v++) {
    const pr = hist[v]! / total;
    if (pr > 0) entropy -= pr * Math.log2(pr);
  }
  return { low: low / total, high: high / total, entropy };
};

// Mean absolute luma difference between two planes, normalised to 0..1.
export const motionDiff = (a: LumaPlane, b: LumaPlane): number => {
  const n = Math.min(a.data.length, b.data.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a.data[i]! - b.data[i]!);
  return sum / n / 255;
};

// Global translation between two planes via 1-D projection correlation:
// project luma onto x/y axes, find the shift with minimal SAD. Cheap and
// good enough to separate handheld jitter from intentional pans.
export const estimateShift = (
  a: LumaPlane,
  b: LumaPlane,
  maxShift = 12,
): { dx: number; dy: number } => {
  const project = (p: LumaPlane) => {
    const px = new Float64Array(p.w);
    const py = new Float64Array(p.h);
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const v = p.data[y * p.w + x]!;
        px[x]! += v;
        py[y]! += v;
      }
    }
    return { px, py };
  };
  const A = project(a);
  const B = project(b);
  const bestShift = (u: Float64Array, v: Float64Array): number => {
    let best = 0;
    let bestErr = Number.POSITIVE_INFINITY;
    for (let s = -maxShift; s <= maxShift; s++) {
      let err = 0;
      let n = 0;
      for (let i = 0; i < u.length; i++) {
        const j = i + s;
        if (j < 0 || j >= v.length) continue;
        const d = u[i]! - v[j]!;
        err += d * d;
        n++;
      }
      if (n > 0) {
        err /= n;
        if (err < bestErr) {
          bestErr = err;
          best = s;
        }
      }
    }
    return best;
  };
  return { dx: bestShift(A.px, B.px), dy: bestShift(A.py, B.py) };
};

// 흔들림 4단계: RMS of high-frequency shift residuals within a burst.
// Pans have a consistent direction (large mean, small residual); shake has
// alternating direction (small mean, large residual).
export const classifyShake = (shifts: readonly { dx: number; dy: number }[]): ShakeTier => {
  if (shifts.length < 2) return "stable";
  const mags = shifts.map((s) => Math.hypot(s.dx, s.dy));
  const meanDx = shifts.reduce((a, s) => a + s.dx, 0) / shifts.length;
  const meanDy = shifts.reduce((a, s) => a + s.dy, 0) / shifts.length;
  const residual = Math.sqrt(
    shifts.reduce((a, s) => a + (s.dx - meanDx) ** 2 + (s.dy - meanDy) ** 2, 0) / shifts.length,
  );
  const maxMag = Math.max(...mags);
  if (residual < 1.2 && maxMag < 8) return "stable";
  if (residual < 3) return "mild";
  if (residual < 7) return "heavy";
  return "reject";
};

export interface JunkVerdict {
  readonly reasons: readonly JunkReason[];
  readonly quality: number; // 0..1 usable-quality score
}

// Whole-asset junk verdict from per-sample medians (a few soft frames must
// not condemn a clip — intentional shallow DoF etc).
export const judgeJunk = (
  samples: readonly { blurVar: number; low: number; high: number; entropy: number }[],
  shake: ShakeTier,
  durationMs: number,
): JunkVerdict => {
  const reasons: JunkReason[] = [];
  if (samples.length === 0) return { reasons: ["flat"], quality: 0 };
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)]!;
  };
  const blur = med(samples.map((s) => s.blurVar));
  const low = med(samples.map((s) => s.low));
  const high = med(samples.map((s) => s.high));
  const entropy = med(samples.map((s) => s.entropy));

  if (durationMs > 0 && durationMs < 1200) reasons.push("too-short");
  if (blur < 15) reasons.push("blur");
  if (low > 0.75) reasons.push("underexposed");
  if (high > 0.6) reasons.push("overexposed");
  if (entropy < 2.2) reasons.push("flat"); // pocket shot / lens covered
  if (shake === "reject") reasons.push("shake");

  // Quality: sharpness (log-scaled), exposure sanity, entropy richness.
  const sharp = Math.max(0, Math.min(1, Math.log10(1 + blur) / 3));
  const exposure = Math.max(0, 1 - low * 1.2 - high * 1.5);
  const richness = Math.max(0, Math.min(1, (entropy - 2) / 5));
  const shakePenalty = shake === "stable" ? 1 : shake === "mild" ? 0.85 : 0.5;
  const quality = Math.max(0, Math.min(1, (0.45 * sharp + 0.3 * exposure + 0.25 * richness) * shakePenalty));
  return { reasons, quality };
};
