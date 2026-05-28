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

export const getPluginEffects = (): readonly EffectDefinition[] =>
  Array.from(plugins.values());

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

export const getPluginShader = (id: string): { fs: string } | undefined =>
  shaders.get(id);

// Public entry point exposed on `window` so plugins loaded as <script>
// tags or via dynamic import can find the SDK.
export interface CutEditorPluginSdk {
  readonly version: 1;
  registerEffect: typeof registerEffect;
  unregisterEffect: typeof unregisterEffect;
  registerShader: typeof registerShader;
}

export const installPluginSdk = (): void => {
  if (typeof window === "undefined") return;
  (window as unknown as { cutEditor?: CutEditorPluginSdk }).cutEditor = {
    version: 1,
    registerEffect,
    unregisterEffect,
    registerShader,
  };
};
