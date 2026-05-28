import type { EffectDefinition } from "../types";

// Noise gate: attenuates audio that sits below a threshold (room tone, hiss
// between speech). Applied directly by the audio mixer, not the GPU pipeline.
export const audioNoiseGate: EffectDefinition = {
  type: "audio-noise-gate",
  name: "Noise gate",
  keywords: ["gate", "noise", "hiss", "silence", "clean"],
  category: "audio",
  params: [
    { kind: "number", key: "thresholdDb", label: "Threshold (dB)", min: -80, max: 0, step: 1, default: -45 },
    { kind: "number", key: "rangeDb", label: "Reduction (dB)", min: -80, max: 0, step: 1, default: -40 },
    { kind: "number", key: "attackMs", label: "Attack (ms)", min: 0, max: 100, step: 1, default: 5 },
    { kind: "number", key: "releaseMs", label: "Release (ms)", min: 10, max: 1000, step: 10, default: 120 },
  ],
  passes: [],
};
