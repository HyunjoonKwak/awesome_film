import type { Clip } from "../model/clip";
import { clipEnd } from "../model/clip";
import type { Transition } from "../model/transition";
import type { Ms } from "../utils/time";

export interface TransitionFrame {
  readonly type: Transition["type"];
  readonly progress: number; // 0..1 — 0 = fully outgoing, 1 = fully incoming
  readonly direction: "in" | "out";
}

// Given the playhead and a clip, return an active transition descriptor
// if the playhead falls inside the clip's incoming or outgoing transition
// window.
export const activeTransitionFor = (clip: Clip, playheadMs: Ms): TransitionFrame | null => {
  if (clip.transitionIn && playheadMs >= clip.start && playheadMs < clip.start + clip.transitionIn.duration) {
    const dur = clip.transitionIn.duration || 1;
    return {
      type: clip.transitionIn.type,
      progress: Math.min(1, Math.max(0, (playheadMs - clip.start) / dur)),
      direction: "in",
    };
  }
  if (clip.transitionOut) {
    const dur = clip.transitionOut.duration || 1;
    const endStart = clipEnd(clip) - dur;
    if (playheadMs >= endStart && playheadMs < clipEnd(clip)) {
      return {
        type: clip.transitionOut.type,
        progress: Math.min(1, Math.max(0, 1 - (playheadMs - endStart) / dur)),
        direction: "out",
      };
    }
  }
  return null;
};
