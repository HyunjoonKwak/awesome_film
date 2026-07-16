import type { EffectDefinition } from "./types";

// Plugin SDK surface: third-party code can register additional effect
// definitions and (later) WGSL/GLSL shader sources. The renderer reads
// from `listEffects()` which already includes plugin effects.

const plugins = new Map<string, EffectDefinition>();
type PluginListener = (effects: readonly EffectDefinition[]) => void;
const listeners = new Set<PluginListener>();

export const registerEffect = (def: EffectDefinition): void => {
  plugins.set(def.type, def);
  emit();
};

export const unregisterEffect = (type: string): void => {
  plugins.delete(type);
  emit();
};

export const getPluginEffects = (): readonly EffectDefinition[] => Array.from(plugins.values());

export const subscribeEffects = (fn: PluginListener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const emit = () => {
  const list = getPluginEffects();
  for (const fn of listeners) fn(list);
};

// Plugin shader registry — plugins can ship their own fragment shaders.
const shaders = new Map<string, { fs: string }>();

export const registerShader = (id: string, fragmentSource: string): void => {
  shaders.set(id, { fs: fragmentSource });
};

export const unregisterShader = (id: string): void => {
  shaders.delete(id);
};

export const getPluginShader = (id: string): { fs: string } | undefined => shaders.get(id);
