// Shared, non-exported helpers used by every mutate-* module. Keeping them
// in one place avoids drift between the slices and makes the public API in
// each slice file easier to scan.

import type { Project, Timeline } from "../model/project";
import type { Track } from "../model/track";
import { computeDuration } from "./query";

export const replaceTrack = (timeline: Timeline, updated: Track): Timeline => ({
  ...timeline,
  tracks: timeline.tracks.map((t) => (t.id === updated.id ? updated : t)),
});

export const recompute = (project: Project): Project => ({
  ...project,
  updatedAt: Date.now(),
  timeline: { ...project.timeline, duration: computeDuration(project.timeline) },
});

// Returns a copy of `o` with key `k` stripped. Required by
// `exactOptionalPropertyTypes` so callers don't assign `undefined`.
export const dropKey = <T, K extends keyof T>(o: T, k: K): Omit<T, K> => {
  const { [k]: _drop, ...rest } = o;
  return rest as Omit<T, K>;
};

