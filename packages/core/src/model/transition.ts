import type { Ms } from "../utils/time";

export type TransitionType =
  | "fade"
  | "dip-to-black"
  | "dip-to-white"
  | "cross-dissolve"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "spin"
  | "wipe"
  | "wipe-left"
  | "wipe-right"
  | "wipe-up"
  | "wipe-down"
  | "wipe-circle";

// Directional wipes drive a GPU mask in the final blit pass rather than the
// transform approximation used by slides/fades.
export const isWipe = (type: TransitionType): boolean =>
  type === "wipe" ||
  type === "wipe-left" ||
  type === "wipe-right" ||
  type === "wipe-up" ||
  type === "wipe-down" ||
  type === "wipe-circle";

export interface Transition {
  readonly type: TransitionType;
  readonly duration: Ms;
}
