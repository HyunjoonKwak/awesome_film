import type { EffectDefinition } from "../types";

// Audio-only effects don't go through the GPU pipeline; the audio mixer
// reads their type + params directly. We still register them so they show
// up in the inspector "Add effect" menu under the Audio category.
export const audioGain: EffectDefinition = {
  type: "audio-gain",
  name: "Gain",
  keywords: ["volume", "loudness"],
  category: "audio",
  params: [
    { kind: "number", key: "db", label: "Gain (dB)", min: -24, max: 12, step: 0.1, default: 0 },
  ],
  passes: [],
};
