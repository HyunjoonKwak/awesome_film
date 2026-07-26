import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { createEmptyProject } from "../../model/factory";
import { newId } from "../../utils/id";
import { editPoints, nextEditPoint, prevEditPoint } from "../edit-points";
import { addClip } from "../mutate";

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

describe("edit points", () => {
  it("collects sorted unique clip boundaries across all tracks", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    let p = addClip(p0, video!.id, makeMediaClip(0, 1000));
    p = addClip(p, video!.id, makeMediaClip(1000, 500));
    // audio clip sharing a boundary with the video cut — deduped
    p = addClip(p, audio!.id, makeMediaClip(1000, 2000));

    expect(editPoints(p.timeline)).toEqual([0, 1000, 1500, 3000]);
  });

  it("returns just the timeline origin for an empty timeline", () => {
    expect(editPoints(createEmptyProject().timeline)).toEqual([0]);
  });

  it("nextEditPoint skips the point at the playhead itself", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const p = addClip(p0, tid, makeMediaClip(0, 1000));

    expect(nextEditPoint(p.timeline, 0)).toBe(1000);
    expect(nextEditPoint(p.timeline, 500)).toBe(1000);
    expect(nextEditPoint(p.timeline, 1000)).toBeNull();
  });

  it("prevEditPoint skips the point at the playhead itself", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const p = addClip(p0, tid, makeMediaClip(0, 1000));

    expect(prevEditPoint(p.timeline, 1000)).toBe(0);
    expect(prevEditPoint(p.timeline, 500)).toBe(0);
    expect(prevEditPoint(p.timeline, 0)).toBeNull();
  });
});
