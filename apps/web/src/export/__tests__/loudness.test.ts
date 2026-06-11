import { describe, expect, it } from "vitest";
import { measureLoudness } from "../loudness";

// Generates `seconds` of a sine tone at the given amplitude and frequency.
const sine = (amp: number, freq: number, seconds: number, sr = 48_000): Float32Array => {
  const out = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < out.length; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / sr);
  }
  return out;
};

describe("measureLoudness", () => {
  it("reports -Infinity LUFS for digital silence", () => {
    const res = measureLoudness(new Float32Array(48_000), 48_000);
    expect(res.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
    expect(res.peakDbfs).toBe(Number.NEGATIVE_INFINITY);
  });

  it("computes sample peak in dBFS", () => {
    const res = measureLoudness(sine(0.5, 1000, 2), 48_000);
    // 0.5 amplitude → ~-6 dBFS peak.
    expect(res.peakDbfs).toBeCloseTo(-6.02, 1);
  });

  it("gives a louder reading for a higher-amplitude tone", () => {
    const quiet = measureLoudness(sine(0.1, 1000, 3), 48_000);
    const loud = measureLoudness(sine(0.6, 1000, 3), 48_000);
    expect(Number.isFinite(quiet.integratedLufs)).toBe(true);
    expect(Number.isFinite(loud.integratedLufs)).toBe(true);
    expect(loud.integratedLufs).toBeGreaterThan(quiet.integratedLufs);
  });
});
