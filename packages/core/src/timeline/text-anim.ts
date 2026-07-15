import type { TextClip, ClipTransform } from "../model/clip";
import { clipTransform } from "../model/clip";
import type { Ms } from "../utils/time";

export interface TextAnimState {
  // Visible character fraction for typewriter (1 = all shown).
  readonly charFrac: number;
  // Extra transform to apply on top of the clip transform.
  readonly transform: ClipTransform;
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

// Compute the animation state for a text clip at clip-relative time.
// `animMs` defaults to 500. Handles both in (start) and out (end) windows.
export const textAnimAt = (clip: TextClip, clipRelMs: Ms): TextAnimState => {
  const base = clipTransform(clip);
  const animMs = clip.animMs ?? 500;
  const inAnim = clip.animIn ?? "none";
  const outAnim = clip.animOut ?? "none";

  let charFrac = 1;
  const dx = 0;
  let dy = 0;
  let opacityMul = 1;
  let scaleMul = 1;

  // Intro window.
  if (inAnim !== "none" && clipRelMs < animMs) {
    const p = easeOut(Math.max(0, Math.min(1, clipRelMs / animMs)));
    applyAnim(inAnim, p, true);
  }
  // Outro window.
  const outStart = clip.duration - animMs;
  if (outAnim !== "none" && clipRelMs > outStart) {
    const p = easeOut(Math.max(0, Math.min(1, (clip.duration - clipRelMs) / animMs)));
    applyAnim(outAnim, p, false);
  }

  function applyAnim(kind: string, p: number, isIn: boolean) {
    // Intro pulls the clip toward rest as p→1; the outro must push back out
    // the SAME edge it entered from, so slide direction flips on the way out
    // (a slide-up outro exits upward, not downward).
    const dir = isIn ? 1 : -1;
    switch (kind) {
      case "fade":
        opacityMul *= p;
        break;
      case "typewriter":
        if (isIn) charFrac = p;
        else charFrac = Math.min(charFrac, p);
        break;
      case "slide-up":
        dy += (1 - p) * 0.3 * dir;
        opacityMul *= p;
        break;
      case "slide-down":
        dy -= (1 - p) * 0.3 * dir;
        opacityMul *= p;
        break;
      case "pop":
        scaleMul *= 0.6 + 0.4 * p;
        opacityMul *= p;
        break;
    }
  }

  return {
    charFrac,
    transform: {
      x: base.x + dx,
      y: base.y + dy,
      scale: base.scale * scaleMul,
      rotation: base.rotation,
      opacity: base.opacity * opacityMul,
    },
  };
};
