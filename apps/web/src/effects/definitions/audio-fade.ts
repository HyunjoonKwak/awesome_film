import type { EffectDefinition } from "../types";

export const audioFade: EffectDefinition = {
  type: "audio-fade",
  name: "Fade in / out",
  keywords: ["volume", "envelope"],
  category: "audio",
  params: [
    { kind: "number", key: "fadeInMs", label: "Fade in (ms)", min: 0, max: 5000, step: 50, default: 0 },
    { kind: "number", key: "fadeOutMs", label: "Fade out (ms)", min: 0, max: 5000, step: 50, default: 0 },
  ],
  passes: [],
};
