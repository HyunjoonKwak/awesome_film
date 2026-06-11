import { clipEnd, type Clip } from "../model/clip";
import type { ID } from "../utils/id";
import type { Ms } from "../utils/time";

// Magnetic-timeline collision rule: clips on a track may never overlap.
// Given a candidate start for a clip of `durationMs`, return the closest
// start that fits entirely inside a free gap on the track. `excludeId`
// removes the clip being moved from the collision set so it doesn't
// collide with itself.
export const resolvePlacement = (
  clips: readonly Clip[],
  durationMs: Ms,
  candidate: Ms,
  excludeId?: ID,
): Ms => {
  const others = clips
    .filter((c) => c.id !== excludeId)
    .slice()
    .sort((a, b) => a.start - b.start);

  if (others.length === 0) return Math.max(0, candidate);

  // Walk the occupied intervals and collect every gap wide enough to host
  // the clip, as inclusive [from, to] ranges of valid start positions.
  const gaps: Array<{ from: Ms; to: Ms }> = [];
  let cursor: Ms = 0;
  for (const c of others) {
    if (c.start - cursor >= durationMs) gaps.push({ from: cursor, to: c.start - durationMs });
    cursor = Math.max(cursor, clipEnd(c));
  }
  gaps.push({ from: cursor, to: Number.POSITIVE_INFINITY });

  let best: Ms = cursor;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const g of gaps) {
    const s = Math.min(Math.max(candidate, g.from), g.to);
    const dist = Math.abs(s - candidate);
    if (dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return Math.max(0, best);
};
