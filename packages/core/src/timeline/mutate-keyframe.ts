// Clip-level keyframe ops. The lower-level math (sampling, cubic-bezier
// solver) lives in keyframes.ts; this module manipulates the keyframe
// TRACKS that live on a clip.

import type { Project } from "../model/project";
import type { Clip } from "../model/clip";
import type { BezierHandles, EasingFn, Keyframe } from "../model/keyframe";
import type { ID } from "../utils/id";
import type { Ms } from "../utils/time";
import { updateClip } from "./mutate-core";

// Add or replace a keyframe for `target` at clip-relative `atMs`. Creates the
// keyframe track if it doesn't exist yet. `target` is a dotted path such as
// "transform.x" or "effects.<id>.amount".
export const upsertClipKeyframe = (
  project: Project,
  clipId: ID,
  target: string,
  atMs: Ms,
  value: number,
  easing: EasingFn = "ease-in-out",
): Project =>
  updateClip(project, clipId, (c) => {
    const kf: Keyframe = { at: Math.max(0, Math.round(atMs)), value, easing };
    const tracks = [...c.keyframes];
    const idx = tracks.findIndex((t) => t.target === target);
    if (idx < 0) {
      tracks.push({ target, keyframes: [kf] });
    } else {
      const existing = tracks[idx]!;
      const kfs = [...existing.keyframes];
      const at = kfs.findIndex((k) => Math.abs(k.at - kf.at) < 1);
      // Preserve a keyframe's easing/bezier when only its value is updated
      // (e.g. dragging it in the graph) so custom curves survive edits.
      if (at >= 0) {
        const prev = kfs[at]!;
        kfs[at] = { ...kf, easing: prev.easing, ...(prev.bezier ? { bezier: prev.bezier } : {}) };
      } else kfs.push(kf);
      tracks[idx] = { ...existing, keyframes: kfs.sort((a, b) => a.at - b.at) };
    }
    return { ...c, keyframes: tracks };
  });

// Updates only the easing (and optional bezier handles) of an existing
// keyframe, leaving its time and value untouched.
export const setClipKeyframeEasing = (
  project: Project,
  clipId: ID,
  target: string,
  atMs: Ms,
  easing: EasingFn,
  bezier?: BezierHandles,
): Project =>
  updateClip(project, clipId, (c) => {
    const tracks = c.keyframes.map((tr) => {
      if (tr.target !== target) return tr;
      const kfs = tr.keyframes.map((k) =>
        Math.abs(k.at - atMs) < 1
          ? ({ ...k, easing, ...(easing === "bezier" && bezier ? { bezier } : {}) } as Keyframe)
          : k,
      );
      return { ...tr, keyframes: kfs };
    });
    return { ...c, keyframes: tracks };
  });

export const removeClipKeyframe = (
  project: Project,
  clipId: ID,
  target: string,
  atMs: Ms,
): Project =>
  updateClip(project, clipId, (c) => {
    const tracks = c.keyframes
      .map((t) =>
        t.target === target
          ? { ...t, keyframes: t.keyframes.filter((k) => Math.abs(k.at - atMs) >= 1) }
          : t,
      )
      .filter((t) => t.keyframes.length > 0);
    return { ...c, keyframes: tracks };
  });

// Replace a clip's entire keyframe track list (used for paste).
export const setClipKeyframes = (
  project: Project,
  clipId: ID,
  tracks: Clip["keyframes"],
): Project => updateClip(project, clipId, (c) => ({ ...c, keyframes: tracks }));

export const clearClipKeyframes = (project: Project, clipId: ID, target: string): Project =>
  updateClip(project, clipId, (c) => ({
    ...c,
    keyframes: c.keyframes.filter((t) => t.target !== target),
  }));
