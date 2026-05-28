import { describe, expect, it } from "vitest";
import { applyNoiseGate } from "../audio-mixer";

const rms = (x: Float32Array, start = 0, end = x.length): number => {
  let sum = 0;
  for (let i = start; i < end; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / Math.max(1, end - start));
};

describe("applyNoiseGate", () => {
  it("attenuates a quiet (sub-threshold) signal", () => {
    const sr = 48_000;
    // -60 dBFS tone, threshold at -40 dB → should be gated down.
    const amp = Math.pow(10, -60 / 20);
    const x = new Float32Array(sr);
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * 1000 * i) / sr);
    const out = applyNoiseGate(x, sr, -40, -40, 5, 120);
    // After the release settles, the tail should be much quieter than input.
    expect(rms(out, sr - 4800, sr)).toBeLessThan(rms(x, sr - 4800, sr) * 0.2);
  });

  it("passes a loud (above-threshold) signal largely intact", () => {
    const sr = 48_000;
    const amp = Math.pow(10, -6 / 20); // ~0.5
    const x = new Float32Array(sr);
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * 1000 * i) / sr);
    const out = applyNoiseGate(x, sr, -40, -40, 5, 120);
    // Steady-state RMS should be close to the original after the gate opens.
    expect(rms(out, sr - 4800, sr)).toBeGreaterThan(rms(x, sr - 4800, sr) * 0.85);
  });
});
