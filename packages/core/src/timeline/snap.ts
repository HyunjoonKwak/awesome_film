import type { Timeline } from "../model/project";
import { clipEnd, type Clip } from "../model/clip";
import type { Ms } from "../utils/time";
import type { ID } from "../utils/id";

export interface SnapOptions {
  readonly toleranceMs: Ms;
  readonly excludeClipId?: ID;
  readonly includePlayhead?: boolean;
}

// Gather all snap candidate points from the timeline: clip starts and ends,
// optionally the playhead. Excludes one clip id so that the clip being
// dragged doesn't snap to itself.
export const collectSnapPoints = (
  timeline: Timeline,
  excludeId?: ID,
  includePlayhead = true,
): readonly Ms[] => {
  const points: Ms[] = [0];
  for (const track of timeline.tracks) {
    for (const c of track.clips) {
      if (c.id === excludeId) continue;
      points.push(c.start, clipEnd(c));
    }
  }
  for (const m of timeline.markers ?? []) points.push(m.at);
  if (includePlayhead) points.push(timeline.playhead);
  return points;
};

// Snap a candidate timestamp to the nearest snap point within tolerance.
// Returns the original value when nothing is close enough.
export const snapToNearest = (
  candidate: Ms,
  points: readonly Ms[],
  toleranceMs: Ms,
): Ms => {
  let best = candidate;
  let bestDelta = toleranceMs;
  for (const p of points) {
    const delta = Math.abs(p - candidate);
    if (delta <= bestDelta) {
      best = p;
      bestDelta = delta;
    }
  }
  return best;
};

export const snapClipStart = (
  timeline: Timeline,
  clip: Clip,
  newStart: Ms,
  opts: SnapOptions,
): Ms => {
  const points = collectSnapPoints(timeline, opts.excludeClipId ?? clip.id, opts.includePlayhead);
  // Snap by either the start edge or the end edge — whichever actually
  // landed on a snap point. If both did, prefer the smaller adjustment.
  const newEnd = newStart + clip.duration;
  const startCand = snapToNearest(newStart, points, opts.toleranceMs);
  const endCand = snapToNearest(newEnd, points, opts.toleranceMs);
  const startMoved = startCand !== newStart;
  const endMoved = endCand !== newEnd;
  if (startMoved && endMoved) {
    return Math.abs(startCand - newStart) <= Math.abs(endCand - newEnd)
      ? startCand
      : endCand - clip.duration;
  }
  if (startMoved) return startCand;
  if (endMoved) return endCand - clip.duration;
  return newStart;
};
