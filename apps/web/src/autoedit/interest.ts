import type { FrameSample } from "./types";

// Fuse per-sample signals into a 0..1 interest curve. Weights follow the
// design doc's composite (motion + audio + faces/smile + quality); semantic
// and aesthetic terms join in P5 by re-running fusion with extras.
export interface InterestExtras {
  readonly audioRms?: readonly number[]; // per-second envelope
  readonly semantic?: readonly number[]; // per-sample prompt-bank score
  readonly aesthetic?: number; // whole-asset aesthetic
}

export const fuseInterest = (
  samples: readonly FrameSample[],
  quality: number,
  extras: InterestExtras = {},
): readonly number[] => {
  if (samples.length === 0) return [];
  const maxMotion = Math.max(0.0001, ...samples.map((s) => s.motion));
  return samples.map((s, i) => {
    const motion = s.motion / maxMotion;
    const sec = Math.floor(s.atMs / 1000);
    const audio = extras.audioRms?.[Math.min(sec, (extras.audioRms?.length ?? 1) - 1)] ?? 0;
    const smile = s.smile ?? 0;
    const face = s.faceArea ? Math.min(1, s.faceArea * 4) : 0;
    const semantic = extras.semantic?.[i] ?? 0;
    const aesthetic = extras.aesthetic ?? 0;

    // Weighted fusion; smile is the strongest single family signal.
    const base =
      0.22 * motion +
      0.16 * audio +
      0.26 * smile +
      0.1 * face +
      0.14 * semantic +
      0.12 * aesthetic;
    // Quality gates the whole thing — a blurry exciting frame still loses.
    return Math.max(0, Math.min(1, (base + 0.1) * (0.4 + 0.6 * quality)));
  });
};

// Best window inside an asset: contiguous run of samples with the highest
// mean interest, at least minMs long. Returns source-relative start ms.
export const bestWindow = (
  samples: readonly FrameSample[],
  interest: readonly number[],
  minMs: number,
): { startMs: number; score: number } => {
  if (samples.length === 0) return { startMs: 0, score: 0 };
  if (samples.length === 1) return { startMs: samples[0]!.atMs, score: interest[0] ?? 0 };
  const stepMs = Math.max(1, samples[1]!.atMs - samples[0]!.atMs);
  const win = Math.max(1, Math.round(minMs / stepMs));
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i + win <= interest.length; i++) {
    let sum = 0;
    for (let k = 0; k < win; k++) sum += interest[i + k]!;
    const mean = sum / win;
    if (mean > bestScore) {
      bestScore = mean;
      best = i;
    }
  }
  return { startMs: samples[best]!.atMs, score: Math.max(0, bestScore) };
};
