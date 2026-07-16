import { describe, expect, it } from "vitest";
import { LoudnessMeter, measureLoudness } from "../loudness";

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

  it("measures stereo energy without phase-cancelling opposing channels", () => {
    const left = sine(0.25, 1000, 2);
    const right = Float32Array.from(left, (sample) => -sample);
    const mono = measureLoudness(left, 48_000);
    const stereo = measureLoudness([left, right], 48_000);

    expect(Number.isFinite(stereo.integratedLufs)).toBe(true);
    expect(stereo.integratedLufs - mono.integratedLufs).toBeCloseTo(3.01, 1);
  });

  it("matches a whole-buffer measurement when PCM arrives in chunks", () => {
    const left = sine(0.3, 440, 3);
    const right = sine(0.2, 880, 3);
    const whole = measureLoudness([left, right], 48_000);
    const meter = new LoudnessMeter(48_000, 2);
    for (let from = 0; from < left.length; from += 7777) {
      meter.push([left.subarray(from, from + 7777), right.subarray(from, from + 7777)]);
    }
    const streamed = meter.result();

    expect(streamed.integratedLufs).toBeCloseTo(whole.integratedLufs, 5);
    expect(streamed.peakDbfs).toBeCloseTo(whole.peakDbfs, 5);
  });
});
