// Integrated loudness measurement per ITU-R BS.1770 / EBU R128.
//
// The signal is K-weighted (a high-shelf "pre" filter followed by an RLB
// high-pass), split into 400 ms blocks with 75% overlap, then gated in two
// stages (absolute -70 LUFS, then relative -10 LU) before averaging. The mix
// is mono at a fixed 48 kHz, so the channel weighting term G is 1.0.

interface Coef {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
}

// Biquad coefficients are defined by BS.1770-4 for a 48 kHz sample rate.
const PRE: Coef = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
};

const RLB: Coef = {
  b0: 1.0,
  b1: -2.0,
  b2: 1.0,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
};

// Direct Form I biquad over the whole signal, returning a new array.
const biquad = (x: Float32Array, c: Coef): Float32Array => {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xn = x[i]!;
    const yn = c.b0 * xn + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = xn;
    y2 = y1;
    y1 = yn;
    y[i] = yn;
  }
  return y;
};

export interface LoudnessResult {
  readonly integratedLufs: number; // -Infinity for silence
  readonly peakDbfs: number;       // sample peak in dBFS
}

const BLOCK_SECONDS = 0.4;
const OVERLAP = 0.75;
const ABSOLUTE_GATE = -70; // LUFS
const RELATIVE_GATE = -10; // LU below the ungated mean

export const measureLoudness = (
  pcm: Float32Array,
  sampleRate = 48_000,
): LoudnessResult => {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const a = Math.abs(pcm[i]!);
    if (a > peak) peak = a;
  }
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -Infinity;

  const weighted = biquad(biquad(pcm, PRE), RLB);
  const blockLen = Math.round(BLOCK_SECONDS * sampleRate);
  const step = Math.max(1, Math.round(blockLen * (1 - OVERLAP)));
  if (weighted.length < blockLen) {
    return { integratedLufs: -Infinity, peakDbfs };
  }

  // Mean square per block.
  const meanSquares: number[] = [];
  for (let start = 0; start + blockLen <= weighted.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + blockLen; i++) {
      const v = weighted[i]!;
      sum += v * v;
    }
    meanSquares.push(sum / blockLen);
  }

  const loudnessOf = (ms: number) => -0.691 + 10 * Math.log10(ms);

  // Absolute gating at -70 LUFS.
  const absKept = meanSquares.filter((ms) => ms > 0 && loudnessOf(ms) >= ABSOLUTE_GATE);
  if (absKept.length === 0) return { integratedLufs: -Infinity, peakDbfs };

  // Relative threshold from the absolute-gated mean.
  const absMean = absKept.reduce((s, v) => s + v, 0) / absKept.length;
  const relThreshold = loudnessOf(absMean) + RELATIVE_GATE;
  const relKept = absKept.filter((ms) => loudnessOf(ms) >= relThreshold);
  if (relKept.length === 0) return { integratedLufs: -Infinity, peakDbfs };

  const relMean = relKept.reduce((s, v) => s + v, 0) / relKept.length;
  return { integratedLufs: loudnessOf(relMean), peakDbfs };
};
