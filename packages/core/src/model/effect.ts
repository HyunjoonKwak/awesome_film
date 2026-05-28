import type { ID } from "../utils/id";

export type EffectParamValue = number | string | boolean;

export interface EffectInstance {
  readonly id: ID;
  readonly type: string;       // matches EffectDefinition.type
  readonly enabled: boolean;
  readonly params: Readonly<Record<string, EffectParamValue>>;
}
