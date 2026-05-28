import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../model/factory";
import { newId, asId } from "../../utils/id";
import { createMulticamProgram, switchAngleAt } from "../multicam";
import { isMediaClip } from "../../model/clip";

const angle = (label: string, offsetMs = 0) => ({
  assetId: newId(),
  offsetMs,
  label,
});

describe("multicam", () => {
  it("creates a program track from the first angle", () => {
    const p0 = createEmptyProject();
    const angles = [angle("A"), angle("B")];
    const { project, programClipId } = createMulticamProgram(p0, angles, 5000);

    expect(programClipId).not.toBeNull();
    const track = project.timeline.tracks.find((t) => t.name === "Multicam");
    expect(track).toBeDefined();
    expect(track!.clips).toHaveLength(1);
    const clip = track!.clips[0]!;
    expect(isMediaClip(clip) && clip.assetId).toBe(angles[0]!.assetId);
    expect(clip.duration).toBe(5000);
  });

  it("switches angle by splitting and repointing the right slice", () => {
    const p0 = createEmptyProject();
    const angles = [angle("A"), angle("B", 1000)];
    const { project } = createMulticamProgram(p0, angles, 6000);

    const switched = switchAngleAt(project, 3000, angles[1]!);
    const track = switched.timeline.tracks.find((t) => t.name === "Multicam")!;
    expect(track.clips).toHaveLength(2);

    const right = track.clips.find((c) => Math.abs(c.start - 3000) < 1)!;
    expect(isMediaClip(right) && right.assetId).toBe(angles[1]!.assetId);
    // trimIn = angle offset (1000) + relative position (3000)
    if (isMediaClip(right)) expect(right.trimIn).toBe(4000);
  });

  it("is a no-op when there is no multicam track", () => {
    const p0 = createEmptyProject();
    const result = switchAngleAt(p0, 1000, { assetId: asId("x"), offsetMs: 0, label: "X" });
    expect(result).toBe(p0);
  });
});
