// Effect definitions describe a GPU pass chain. Phase 4 wires this into a
// real WebGL renderer; for now the registry shape is fixed so effect authors
// can land definitions without waiting for the runtime.

export type ParamKind = "number" | "boolean" | "color" | "enum";

export interface NumberParam {
  kind: "number";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface BooleanParam {
  kind: "boolean";
  key: string;
  label: string;
  default: boolean;
}

export interface ColorParam {
  kind: "color";
  key: string;
  label: string;
  default: string; // hex
}

export interface EnumParam {
  kind: "enum";
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
  default: string;
}

export type ParamDef = NumberParam | BooleanParam | ColorParam | EnumParam;

export type EffectParams = Readonly<Record<string, number | boolean | string>>;

export interface EffectPass {
  readonly shader: string; // identifier into the shader registry
  readonly uniforms: (ctx: { params: EffectParams; width: number; height: number }) => Record<
    string,
    number | readonly number[]
  >;
}

export interface EffectDefinition {
  readonly type: string;
  readonly name: string;
  readonly keywords: readonly string[];
  readonly category: "color" | "blur" | "stylize" | "transform" | "audio";
  readonly params: readonly ParamDef[];
  readonly passes: readonly EffectPass[];
}

export const defaultParamsOf = (def: EffectDefinition): EffectParams =>
  Object.fromEntries(def.params.map((p) => [p.key, p.default]));
