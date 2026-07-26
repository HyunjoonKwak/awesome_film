import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { createEmptyProject } from "../../model/factory";
import { newId } from "../../utils/id";
import { addClip, rippleDeleteClip } from "../mutate";
import { findClip } from "../query";

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

describe("rippleDeleteClip across tracks", () => {
  it("pulls clips on other tracks past the cut point, keeping A/V sync", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const v1 = makeMediaClip(0, 1000);
    const v2 = makeMediaClip(1000, 1000);
    const a2 = makeMediaClip(1000, 1000); // audio aligned with v2
    let p = addClip(p0, video!.id, v1);
    p = addClip(p, video!.id, v2);
    p = addClip(p, audio!.id, a2);

    const p2 = rippleDeleteClip(p, v1.id);

    expect(findClip(p2.timeline, v2.id)!.start).toBe(0);
    expect(findClip(p2.timeline, a2.id)!.start).toBe(0);
  });

  it("clamps pulled clips against earlier clips on their own track", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const v1 = makeMediaClip(1000, 2000); // deleting frees [1000, 3000)
    const aEarly = makeMediaClip(0, 2500); // audio ends at 2500 — blocks a full pull
    const aLate = makeMediaClip(3000, 1000);
    let p = addClip(p0, video!.id, v1);
    p = addClip(p, audio!.id, aEarly);
    p = addClip(p, audio!.id, aLate);

    const p2 = rippleDeleteClip(p, v1.id);

    // full pull would be 3000 - 2000 = 1000, overlapping aEarly — clamp to 2500
    expect(findClip(p2.timeline, aLate.id)!.start).toBe(2500);
    expect(findClip(p2.timeline, aEarly.id)!.start).toBe(0);
  });

  it("leaves clips that straddle the cut point untouched", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const v1 = makeMediaClip(1000, 1000);
    const straddler = makeMediaClip(500, 2000); // spans the deleted window
    let p = addClip(p0, video!.id, v1);
    p = addClip(p, audio!.id, straddler);

    const p2 = rippleDeleteClip(p, v1.id);

    expect(findClip(p2.timeline, straddler.id)!.start).toBe(500);
  });

  it("does not move clips on locked tracks", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const v1 = makeMediaClip(0, 1000);
    const aLate = makeMediaClip(1000, 1000);
    let p = addClip(p0, video!.id, v1);
    p = addClip(p, audio!.id, aLate);
    p = {
      ...p,
      timeline: {
        ...p.timeline,
        tracks: p.timeline.tracks.map((t) =>
          t.id === audio!.id ? { ...t, locked: true } : t,
        ),
      },
    };

    const p2 = rippleDeleteClip(p, v1.id);

    expect(findClip(p2.timeline, aLate.id)!.start).toBe(1000);
  });
});
