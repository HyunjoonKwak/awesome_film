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

// FCP-style magnetic move: place the moving clip at `targetStart` and push
// downstream clips right as needed so nothing overlaps. The moving clip is
// clamped against overlapping clips on its left (left neighbours are never
// pushed). Call with the track layout captured at drag start so repeated
// calls during one gesture stay idempotent.
export const magneticMove = (
  clips: readonly Clip[],
  movingId: ID,
  targetStart: Ms,
): readonly Clip[] => {
  const moving = clips.find((c) => c.id === movingId);
  if (!moving) return clips;
  const others = clips
    .filter((c) => c.id !== movingId)
    .slice()
    .sort((a, b) => a.start - b.start);

  // Clamp only against clips that were originally on the moving clip's left
  // (dragging onto a left neighbour's tail can't push it); clips originally
  // on the right are pushed instead.
  let start = Math.max(0, targetStart);
  for (const o of others) {
    if (o.start < moving.start && o.start <= start && clipEnd(o) > start) {
      start = clipEnd(o);
    }
  }

  // Push everything that now collides, cascading left to right.
  const result: Clip[] = [{ ...moving, start }];
  let cursor = start + moving.duration;
  for (const o of others) {
    if (clipEnd(o) <= start) {
      result.push(o);
      continue;
    }
    const newStart = Math.max(o.start, cursor);
    result.push(newStart === o.start ? o : { ...o, start: newStart });
    cursor = newStart + o.duration;
  }
  return result.sort((a, b) => a.start - b.start);
};
