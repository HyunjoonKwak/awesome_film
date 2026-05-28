import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../model/factory";
import type { MediaClip } from "../../model/clip";
import { newId } from "../../utils/id";
import { addClip } from "../mutate";
import { upsertClipKeyframe, removeClipKeyframe } from "../mutate";
import { findClip } from "../query";
import { sampleKeyframes } from "../keyframes";

const makeClip = (): MediaClip => ({
  kind: "media",
  id: newId(),
  assetId: newId(),
  start: 0,
  duration: 4000,
  trimIn: 0,
  trimOut: 4000,
  speed: 1,
  effects: [],
  keyframes: [],
});

describe("keyframe mutate", () => {
  it("adds keyframes that the sampler interpolates", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeClip();
    let p = addClip(p0, tid, clip);
    p = upsertClipKeyframe(p, clip.id, "transform.x", 0, 0);
    p = upsertClipKeyframe(p, clip.id, "transform.x", 1000, 1);

    const updated = findClip(p.timeline, clip.id)!;
    const at500 = sampleKeyframes(updated.keyframes, 500);
    expect(at500["transform.x"]).toBeGreaterThan(0);
    expect(at500["transform.x"]).toBeLessThan(1);
  });

  it("replaces a keyframe at the same time", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeClip();
    let p = addClip(p0, tid, clip);
    p = upsertClipKeyframe(p, clip.id, "transform.scale", 500, 1.5);
    p = upsertClipKeyframe(p, clip.id, "transform.scale", 500, 2.0);

    const updated = findClip(p.timeline, clip.id)!;
    const track = updated.keyframes.find((k) => k.target === "transform.scale")!;
    expect(track.keyframes).toHaveLength(1);
    expect(track.keyframes[0]!.value).toBe(2.0);
  });

  it("removes a keyframe and drops empty tracks", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeClip();
    let p = addClip(p0, tid, clip);
    p = upsertClipKeyframe(p, clip.id, "transform.opacity", 0, 1);
    p = removeClipKeyframe(p, clip.id, "transform.opacity", 0);

    const updated = findClip(p.timeline, clip.id)!;
    expect(updated.keyframes.find((k) => k.target === "transform.opacity")).toBeUndefined();
  });
});
