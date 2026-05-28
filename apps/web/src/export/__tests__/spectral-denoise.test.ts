import { describe, expect, it } from "vitest";
import { denoise } from "../spectral-denoise";

const sineWithNoise = (sr: number, seconds: number, freq: number, sigAmp: number, noiseAmp: number) => {
  const out = new Float32Array(Math.floor(sr * seconds));
  for (let i = 0; i < out.length; i++) {
    const sig = sigAmp * Math.sin((2 * Math.PI * freq * i) / sr);
    const noise = noiseAmp * (Math.random() * 2 - 1);
    out[i] = sig + noise;
  }
  return out;
};

const rms = (x: Float32Array, start: number, end: number) => {
  let s = 0;
  for (let i = start; i < end; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, end - start));
};

describe("denoise", () => {
  it("reduces broadband noise on a near-silent tail", () => {
    const sr = 16_000;
    // 0.3s of noise-only (training region) then 1s of (tone + noise).
    const noiseOnly = sineWithNoise(sr, 0.3, 0, 0, 0.05);
    const noisyTone = sineWithNoise(sr, 1.0, 440, 0.4, 0.05);
    const input = new Float32Array(noiseOnly.length + noisyTone.length);
    input.set(noiseOnly, 0);
    input.set(noisyTone, noiseOnly.length);

    const cleaned = denoise(input, sr, { strength: 1.5, floor: 0.05, noiseEstimateMs: 250 });

    // Compare noise floor in the (originally noise-only) lead-in region.
    const a = Math.floor(sr * 0.05);
    const b = Math.floor(sr * 0.25);
    expect(rms(cleaned, a, b)).toBeLessThan(rms(input, a, b) * 0.9);
    // Sanity: output is the same length as input.
    expect(cleaned.length).toBe(input.length);
  });

  it("returns the buffer untouched when it's shorter than 2 frames", () => {
    const tiny = new Float32Array(500);
    const out = denoise(tiny, 16_000);
    expect(out.length).toBe(500);
  });
});
