// Per-clip presentation: transform / mask / blend mode / transitions. All
// thin wrappers around updateClip that respect `exactOptionalPropertyTypes`
// by stripping properties when callers pass undefined / a neutral value.

import type { Project } from "../model/project";
import type { BlendMode, ClipMask, ClipTransform } from "../model/clip";
import { clipTransform } from "../model/clip";
import type { Transition } from "../model/transition";
import type { ID } from "../utils/id";
import { dropKey } from "./mutate-internal";
import { updateClip } from "./mutate-core";

export const setClipTransform = (
  project: Project,
  clipId: ID,
  patch: Partial<ClipTransform>,
): Project =>
  updateClip(project, clipId, (c) => ({
    ...c,
    transform: { ...clipTransform(c), ...patch },
  }));

export const setClipMask = (
  project: Project,
  clipId: ID,
  mask: ClipMask | undefined,
): Project =>
  updateClip(project, clipId, (c) => (mask ? { ...c, mask } : (dropKey(c, "mask") as typeof c)));

export const setClipBlendMode = (
  project: Project,
  clipId: ID,
  mode: BlendMode | undefined,
): Project =>
  updateClip(project, clipId, (c) =>
    mode && mode !== "normal" ? { ...c, blendMode: mode } : (dropKey(c, "blendMode") as typeof c),
  );

export const setTransitionIn = (
  project: Project,
  clipId: ID,
  transition: Transition | undefined,
): Project =>
  updateClip(project, clipId, (c) =>
    transition ? { ...c, transitionIn: transition } : (dropKey(c, "transitionIn") as typeof c),
  );

export const setTransitionOut = (
  project: Project,
  clipId: ID,
  transition: Transition | undefined,
): Project =>
  updateClip(project, clipId, (c) =>
    transition ? { ...c, transitionOut: transition } : (dropKey(c, "transitionOut") as typeof c),
  );
