import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../model/factory";
import type { MediaClip } from "../../model/clip";
import { newId } from "../../utils/id";
import { addClip } from "../mutate";
import { inspectProject } from "../inspect";

const mediaClip = (start: number, duration: number, assetId = newId()): MediaClip => ({
  kind: "media",
  id: newId(),
  assetId,
  start,
  duration,
  trimIn: 0,
  trimOut: duration,
  speed: 1,
  effects: [],
  keyframes: [],
});

describe("inspectProject", () => {
  it("warns about an empty timeline", () => {
    const p = createEmptyProject();
    const issues = inspectProject(p);
    expect(issues.some((i) => i.code === "empty-timeline")).toBe(true);
  });

  it("flags offline media (missing asset)", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const p = addClip(p0, tid, mediaClip(0, 1000));
    const issues = inspectProject(p);
    expect(issues.some((i) => i.code === "offline-media" && i.severity === "error")).toBe(true);
  });

  it("reports gaps between clips", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    let p = addClip(p0, tid, mediaClip(0, 1000));
    p = addClip(p, tid, mediaClip(3000, 1000));
    const issues = inspectProject(p);
    expect(issues.some((i) => i.code === "gap")).toBe(true);
  });
});
