// Spectral-subtraction noise reduction (Boll 1979 with a soft floor to
// suppress musical noise). Used by the `audio-spectral-denoise` effect from
// inside the offline audio mixer. Pure typed-array math — no DOM, no FFI,
// no dependencies — so it stays portable across Worker/main.
//
// Algorithm:
//   1. Frame the signal with a Hann window (size FFT_SIZE, 50% overlap).
//   2. FFT each frame.
//   3. Estimate the noise magnitude spectrum from the first `noiseEstimateMs`
//      of audio (assumed to be near-silence/room tone).
//   4. Subtract: |X'| = max(|X| - α·|N|, β·|X|).
//   5. Reapply original phase, inverse FFT, overlap-add into the output.

const FFT_SIZE = 1024; // 21 ms @ 48 kHz
const HOP = FFT_SIZE / 2; // 50% overlap

// ---- in-place radix-2 Cooley-Tukey FFT ------------------------------------
const fft = (re: Float32Array, im: Float32Array): void => {
  const n = re.length;
  // Bit-reverse permutation.
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  // Butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k]!;
        const uIm = im[i + k]!;
        const vRe = re[i + k + len / 2]! * curRe - im[i + k + len / 2]! * curIm;
        const vIm = re[i + k + len / 2]! * curIm + im[i + k + len / 2]! * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
};

const ifft = (re: Float32Array, im: Float32Array): void => {
  for (let i = 0; i < im.length; i++) im[i] = -im[i]!;
  fft(re, im);
  const inv = 1 / re.length;
  for (let i = 0; i < re.length; i++) {
    re[i] = re[i]! * inv;
    im[i] = -im[i]! * inv;
  }
};

// Hann window cached once per length.
let cachedWindow: Float32Array | null = null;
const hannWindow = (): Float32Array => {
  if (cachedWindow) return cachedWindow;
  const w = new Float32Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
  }
  cachedWindow = w;
  return w;
};

export interface DenoiseOpts {
  // Aggressiveness of the noise subtraction (α). 1 = exactly the estimated
  // noise floor; >1 over-subtracts (cleaner but riskier).
  readonly strength: number;
  // Residual floor (β). Output magnitude is clamped to β·|X| to suppress
  // musical noise artefacts. Common values: 0.05..0.2.
  readonly floor: number;
  // How many milliseconds at the start of the buffer are assumed to be
  // noise-only and used to build the noise profile.
  readonly noiseEstimateMs: number;
}

const DEFAULT_DENOISE: DenoiseOpts = {
  strength: 1.0,
  floor: 0.1,
  noiseEstimateMs: 250,
};

// Estimate average magnitude across the first N frames.
const estimateNoise = (pcm: Float32Array, sampleRate: number, ms: number): Float32Array => {
  const samples = Math.min(pcm.length, Math.floor((ms / 1000) * sampleRate));
  const win = hannWindow();
  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);
  const mag = new Float32Array(FFT_SIZE);
  let frames = 0;
  for (let start = 0; start + FFT_SIZE <= samples; start += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = pcm[start + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < FFT_SIZE; i++) {
      mag[i] = mag[i]! + Math.hypot(re[i]!, im[i]!);
    }
    frames++;
  }
  if (frames === 0) return mag; // bail — silence everywhere or buffer too short
  for (let i = 0; i < FFT_SIZE; i++) mag[i] = mag[i]! / frames;
  return mag;
};

export const denoise = (
  pcm: Float32Array,
  sampleRate: number,
  opts: Partial<DenoiseOpts> = {},
): Float32Array => {
  const { strength, floor, noiseEstimateMs } = { ...DEFAULT_DENOISE, ...opts };
  if (pcm.length < FFT_SIZE * 2) return pcm.slice();

  const noise = estimateNoise(pcm, sampleRate, noiseEstimateMs);
  const win = hannWindow();
  const out = new Float32Array(pcm.length);
  // Hann + 50% overlap gives constant-overlap-add normalisation of 1.0; the
  // window energy term cancels.

  const re = new Float32Array(FFT_SIZE);
  const im = new Float32Array(FFT_SIZE);

  for (let start = 0; start + FFT_SIZE <= pcm.length; start += HOP) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = pcm[start + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let i = 0; i < FFT_SIZE; i++) {
      const m = Math.hypot(re[i]!, im[i]!);
      const n = noise[i]! * strength;
      const newMag = Math.max(m - n, floor * m);
      if (m > 1e-9) {
        const scale = newMag / m;
        re[i] = re[i]! * scale;
        im[i] = im[i]! * scale;
      } else {
        re[i] = 0;
        im[i] = 0;
      }
    }
    ifft(re, im);
    for (let i = 0; i < FFT_SIZE; i++) {
      out[start + i] = out[start + i]! + re[i]! * win[i]!;
    }
  }
  return out;
};
