import type { Timeline } from "../model/project";
import type { Ms } from "../utils/time";

// FCP-style edit-point navigation (↑/↓): every clip boundary on every
// track plus the timeline origin, deduped and sorted.
export const editPoints = (timeline: Timeline): readonly Ms[] => {
  const points = new Set<Ms>([0]);
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      points.add(clip.start);
      points.add(clip.start + clip.duration);
    }
  }
  return [...points].sort((a, b) => a - b);
};

// Epsilon keeps a playhead sitting exactly on a cut from "finding" that
// same cut again (sub-frame float drift would otherwise trap it).
const EPSILON_MS = 1;

export const nextEditPoint = (timeline: Timeline, at: Ms): Ms | null =>
  editPoints(timeline).find((p) => p > at + EPSILON_MS) ?? null;

export const prevEditPoint = (timeline: Timeline, at: Ms): Ms | null => {
  const before = editPoints(timeline).filter((p) => p < at - EPSILON_MS);
  return before.length > 0 ? before[before.length - 1]! : null;
};
