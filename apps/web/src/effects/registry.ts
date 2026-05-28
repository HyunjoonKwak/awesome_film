import type { EffectDefinition } from "./types";
import { brightness } from "./definitions/brightness";
import { contrast } from "./definitions/contrast";
import { saturation } from "./definitions/saturation";
import { hue } from "./definitions/hue";
import { exposure } from "./definitions/exposure";
import { gaussianBlur } from "./definitions/gaussian-blur";
import { sharpen } from "./definitions/sharpen";
import { vignette } from "./definitions/vignette";
import { sepia } from "./definitions/sepia";
import { invert } from "./definitions/invert";
import { grain } from "./definitions/grain";
import { chromaKey } from "./definitions/chroma-key";
import { bgRemove } from "./definitions/bg-remove";
import { audioGain } from "./definitions/audio-gain";
import { audioFade } from "./definitions/audio-fade";
import { audioEq } from "./definitions/audio-eq";
import { audioNoiseGate } from "./definitions/audio-noise-gate";
import { lut } from "./definitions/lut";
import { colorWheels } from "./definitions/color-wheels";
import { whiteBalance } from "./definitions/white-balance";
import { levels } from "./definitions/levels";
import { vibrance } from "./definitions/vibrance";
import { splitTone } from "./definitions/split-tone";
import { getPluginEffects } from "./plugin-registry";

const builtin: readonly EffectDefinition[] = [
  // Color
  brightness,
  contrast,
  exposure,
  saturation,
  hue,
  lut,
  colorWheels,
  whiteBalance,
  levels,
  vibrance,
  splitTone,
  // Blur
  gaussianBlur,
  // Stylize
  sharpen,
  vignette,
  sepia,
  invert,
  grain,
  chromaKey,
  bgRemove,
  // Audio
  audioGain,
  audioFade,
  audioEq,
  audioNoiseGate,
];

const all = (): readonly EffectDefinition[] => [...builtin, ...getPluginEffects()];

export const listEffects = (): readonly EffectDefinition[] => all();
export const getEffect = (type: string): EffectDefinition | undefined =>
  all().find((e) => e.type === type);
export const searchEffects = (q: string): readonly EffectDefinition[] => {
  const query = q.trim().toLowerCase();
  if (!query) return all();
  return all().filter(
    (e) =>
      e.name.toLowerCase().includes(query) ||
      e.keywords.some((k) => k.toLowerCase().includes(query)),
  );
};
