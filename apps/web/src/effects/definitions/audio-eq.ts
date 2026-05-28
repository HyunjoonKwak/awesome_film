import type { EffectDefinition } from "../types";

// 3-band shelving EQ. Decibel ranges follow common DAW defaults.
export const audioEq: EffectDefinition = {
  type: "audio-eq",
  name: "EQ (3-band)",
  keywords: ["bass", "treble", "filter"],
  category: "audio",
  params: [
    { kind: "number", key: "low", label: "Low (dB)", min: -12, max: 12, step: 0.5, default: 0 },
    { kind: "number", key: "mid", label: "Mid (dB)", min: -12, max: 12, step: 0.5, default: 0 },
    { kind: "number", key: "high", label: "High (dB)", min: -12, max: 12, step: 0.5, default: 0 },
  ],
  passes: [],
};
