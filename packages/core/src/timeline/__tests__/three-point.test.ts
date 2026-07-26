import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { createEmptyProject } from "../../model/factory";
import { newId } from "../../utils/id";
import { addClip } from "../mutate";
import { findClip } from "../query";
import { insertClipAt, overwriteClipAt } from "../three-point";

const makeMediaClip = (start = 0, duration = 1000): MediaClip => ({
  kind: "media",
  id: newId(),
  assetId: newId(),
  start,
  duration,
  trimIn: 0,
  trimOut: duration,
  speed: 1,
  effects: [],
  keyframes: [],
});

describe("insertClipAt (FCP W)", () => {
  it("inserts into empty space and shifts later clips right", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const later = makeMediaClip(2000, 1000);
    const p = addClip(p0, tid, later);
    const incoming = makeMediaClip(0, 500);

    const p2 = insertClipAt(p, tid, incoming, 1000);

    expect(findClip(p2.timeline, incoming.id)!.start).toBe(1000);
    expect(findClip(p2.timeline, later.id)!.start).toBe(2500);
  });

  it("splits a straddling clip and ripples its right half", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const long = makeMediaClip(0, 2000);
    const p = addClip(p0, tid, long);
    const incoming = makeMediaClip(0, 500);

    const p2 = insertClipAt(p, tid, incoming, 1000);

    const clips = [...p2.timeline.tracks[0]!.clips].sort((a, b) => a.start - b.start);
    expect(clips).toHaveLength(3);
    // left half of the split stays
    expect(clips[0]!.start).toBe(0);
    expect(clips[0]!.duration).toBe(1000);
    // inserted clip sits in the cut
    expect(clips[1]!.id).toBe(incoming.id);
    expect(clips[1]!.start).toBe(1000);
    // right half rippled past the insert, source offset preserved
    expect(clips[2]!.start).toBe(1500);
    expect(clips[2]!.duration).toBe(1000);
    expect((clips[2] as MediaClip).trimIn).toBe(1000);
    expect(p2.timeline.duration).toBe(2500);
  });

  it("returns the project unchanged for an unknown track", () => {
    const p0 = createEmptyProject();
    const incoming = makeMediaClip(0, 500);

    expect(insertClipAt(p0, newId(), incoming, 0)).toBe(p0);
  });

  it("frame-snaps the incoming clip's duration so later clips stay on grid", () => {
    // 25fps → 40ms frames; 1015ms snaps to 1000.
    const p0 = createEmptyProject({ framerate: 25 });
    const tid = p0.timeline.tracks[0]!.id;
    const later = makeMediaClip(2000, 1000);
    const p = addClip(p0, tid, later);
    const incoming = makeMediaClip(0, 1015);

    const p2 = insertClipAt(p, tid, incoming, 1000);

    expect(findClip(p2.timeline, incoming.id)!.duration).toBe(1000);
    expect(findClip(p2.timeline, later.id)!.start).toBe(3000);
  });

  it("ripples parallel unlocked tracks so A/V stays in sync", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const v = makeMediaClip(1000, 1000);
    const a = makeMediaClip(1000, 1000);
    let p = addClip(p0, video!.id, v);
    p = addClip(p, audio!.id, a);
    const incoming = makeMediaClip(0, 500);

    const p2 = insertClipAt(p, video!.id, incoming, 500);

    expect(findClip(p2.timeline, v.id)!.start).toBe(1500);
    expect(findClip(p2.timeline, a.id)!.start).toBe(1500);
  });
});

describe("overwriteClipAt (FCP D)", () => {
  it("punches a hole in a long clip, keeping head and tail", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const long = makeMediaClip(0, 3000);
    const p = addClip(p0, tid, long);
    const incoming = makeMediaClip(0, 1000);

    const p2 = overwriteClipAt(p, tid, incoming, 1000);

    const clips = [...p2.timeline.tracks[0]!.clips].sort((a, b) => a.start - b.start);
    expect(clips).toHaveLength(3);
    expect(clips[0]!.start).toBe(0);
    expect(clips[0]!.duration).toBe(1000);
    expect(clips[1]!.id).toBe(incoming.id);
    expect(clips[1]!.start).toBe(1000);
    // tail keeps playing from the source where the overwrite ends
    expect(clips[2]!.start).toBe(2000);
    expect(clips[2]!.duration).toBe(1000);
    expect((clips[2] as MediaClip).trimIn).toBe(2000);
    // total duration unchanged — overwrite never ripples
    expect(p2.timeline.duration).toBe(3000);
  });

  it("removes clips fully covered by the overwrite window", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const small = makeMediaClip(1200, 300);
    const p = addClip(p0, tid, small);
    const incoming = makeMediaClip(0, 1000);

    const p2 = overwriteClipAt(p, tid, incoming, 1000);

    const clips = p2.timeline.tracks[0]!.clips;
    expect(clips).toHaveLength(1);
    expect(clips[0]!.id).toBe(incoming.id);
    expect(findClip(p2.timeline, small.id)).toBeUndefined();
  });

  it("trims the tail of a left neighbour and the head of a right neighbour", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const left = makeMediaClip(0, 1500); // overlaps window head
    const right = makeMediaClip(1500, 1500); // overlaps window tail
    let p = addClip(p0, tid, left);
    p = addClip(p, tid, right);
    const incoming = makeMediaClip(0, 1000);

    const p2 = overwriteClipAt(p, tid, incoming, 1000);

    expect(findClip(p2.timeline, left.id)!.duration).toBe(1000);
    const trimmedRight = findClip(p2.timeline, right.id)! as MediaClip;
    expect(trimmedRight.start).toBe(2000);
    expect(trimmedRight.duration).toBe(1000);
    expect(trimmedRight.trimIn).toBe(500);
  });

  it("returns the project unchanged for an unknown track", () => {
    const p0 = createEmptyProject();
    const incoming = makeMediaClip(0, 500);

    expect(overwriteClipAt(p0, newId(), incoming, 0)).toBe(p0);
  });
});
