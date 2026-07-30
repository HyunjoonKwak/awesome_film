import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import type { Track } from "../../model/track";
import { newId, type ID } from "../../utils/id";
import { clipIdsInMarquee } from "../marquee";

const clip = (id: ID, start: number, duration: number): MediaClip => ({
  kind: "media",
  id,
  assetId: newId(),
  start,
  duration,
  trimIn: 0,
  trimOut: duration,
  speed: 1,
  effects: [],
  keyframes: [],
});

const track = (id: ID, clips: MediaClip[]): Track =>
  ({ id, name: "track", kind: "video", height: 60, clips }) as unknown as Track;

// video: v1 spans 0–1000, v2 spans 2000–3000.  audio: a1 spans 500–1500.
const V = newId();
const A = newId();
const v1 = newId();
const v2 = newId();
const a1 = newId();

const TRACKS: Track[] = [
  track(V, [clip(v1, 0, 1000), clip(v2, 2000, 1000)]),
  track(A, [clip(a1, 500, 1000)]),
];
const BOTH: ReadonlySet<ID> = new Set([V, A]);
const VIDEO_ONLY: ReadonlySet<ID> = new Set([V]);

describe("clipIdsInMarquee", () => {
  it("selects clips overlapping the span on the covered tracks", () => {
    expect(clipIdsInMarquee(TRACKS, BOTH, 200, 800)).toEqual([v1, a1]);
  });

  it("spans multiple tracks and multiple clips at once", () => {
    expect(clipIdsInMarquee(TRACKS, BOTH, 0, 3000)).toEqual([v1, v2, a1]);
  });

  it("ignores tracks the band never touched", () => {
    expect(clipIdsInMarquee(TRACKS, new Set([A]), 0, 3000)).toEqual([a1]);
    expect(clipIdsInMarquee(TRACKS, new Set<ID>(), 0, 3000)).toEqual([]);
  });

  it("normalises a right-to-left drag", () => {
    expect(clipIdsInMarquee(TRACKS, BOTH, 800, 200)).toEqual([v1, a1]);
  });

  it("selects a clip the band only partly covers", () => {
    expect(clipIdsInMarquee(TRACKS, BOTH, 900, 1100)).toEqual([v1, a1]);
  });

  it("matches a clip spanning the instant of a zero-width band", () => {
    // Pure interval intersection, so an instant inside a clip still counts.
    // Suppressing "Cmd+click grabbed something" is the panel's job: it ignores
    // a press that never moved.
    expect(clipIdsInMarquee(TRACKS, BOTH, 500, 500)).toEqual([v1]);
  });

  it("excludes a clip touched only at its boundary", () => {
    // v1 ends exactly at 1000 and v2 starts exactly at 2000.
    expect(clipIdsInMarquee(TRACKS, VIDEO_ONLY, 1000, 2000)).toEqual([]);
  });

  it("includes a clip once the band crosses its boundary", () => {
    expect(clipIdsInMarquee(TRACKS, VIDEO_ONLY, 999, 2000)).toEqual([v1]);
    expect(clipIdsInMarquee(TRACKS, VIDEO_ONLY, 1000, 2001)).toEqual([v2]);
  });

  it("selects nothing in a gap between clips", () => {
    expect(clipIdsInMarquee(TRACKS, VIDEO_ONLY, 1200, 1800)).toEqual([]);
  });

  it("returns an empty list when there are no tracks", () => {
    expect(clipIdsInMarquee([], BOTH, 0, 1000)).toEqual([]);
  });
});
