import type { EffectDefinition } from "../types";

// Spectral-subtraction denoiser. Goes beyond the gate by learning a noise
// magnitude profile from the first `noiseEstimateMs` of the clip and
// subtracting it in the frequency domain — useful for hiss/hum that
// survives gating because it overlaps with speech.
export const audioSpectralDenoise: EffectDefinition = {
  type: "audio-spectral-denoise",
  name: "Spectral denoise",
  keywords: ["noise", "hiss", "denoise", "spectral"],
  category: "audio",
  params: [
    { kind: "number", key: "strength", label: "Strength", min: 0, max: 2, step: 0.05, default: 1 },
    { kind: "number", key: "floor", label: "Floor", min: 0, max: 0.5, step: 0.01, default: 0.1 },
    { kind: "number", key: "noiseEstimateMs", label: "Noise estimate (ms)", min: 50, max: 2000, step: 25, default: 250 },
  ],
  passes: [],
};
