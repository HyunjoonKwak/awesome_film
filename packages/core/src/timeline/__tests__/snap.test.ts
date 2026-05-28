import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../model/factory";
import type { MediaClip } from "../../model/clip";
import { newId } from "../../utils/id";
import { addClip } from "../mutate";
import { collectSnapPoints, snapClipStart, snapToNearest } from "../snap";

const clip = (start: number, duration: number): MediaClip => ({
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

describe("snap", () => {
  it("collects start and end of every clip plus zero and playhead", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const p1 = addClip(addClip(p0, tid, clip(0, 1000)), tid, clip(2000, 500));

    const points = collectSnapPoints(p1.timeline);
    expect(points).toEqual(expect.arrayContaining([0, 1000, 2000, 2500]));
  });

  it("snaps to nearest within tolerance", () => {
    expect(snapToNearest(1010, [0, 1000, 2500], 50)).toBe(1000);
    expect(snapToNearest(900, [0, 1000, 2500], 50)).toBe(900); // out of tolerance
  });

  it("snaps clip start or end edge, whichever wins", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const c0 = clip(0, 1000); // ends at 1000
    const moving = clip(2000, 800); // ends at 2800
    const p1 = addClip(addClip(p0, tid, c0), tid, moving);

    // Dragging the "moving" clip near start=995 should snap its start to 1000
    // (start edge to end of c0).
    const snapped = snapClipStart(p1.timeline, moving, 995, { toleranceMs: 50 });
    expect(snapped).toBe(1000);
  });
});
