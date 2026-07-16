import { describe, expect, it } from "vitest";
import { addClip, createEmptyProject, newId, updateClip, type ID, type MediaClip } from "@cut/core";
import {
  diffPendingProject,
  mergePendingProject,
  projectClipJson,
  projectStructureFingerprint,
} from "../project-merge";

const asId = (value: string): ID => value as ID;

const clip = (id: ID, start: number): MediaClip => ({
  id,
  kind: "media",
  assetId: asId(`asset-${id}`),
  start,
  duration: 1000,
  speed: 1,
  trimIn: 0,
  trimOut: 1000,
  effects: [],
  keyframes: [],
});

const projectWithTwoClips = () => {
  const empty = createEmptyProject();
  const trackId = empty.timeline.tracks[0]?.id ?? newId();
  return addClip(addClip(empty, trackId, clip(asId("a"), 0)), trackId, clip(asId("b"), 1000));
};

describe("pending collaboration merge", () => {
  it("preserves unsent local clip edits while accepting a different remote clip edit", () => {
    const baseline = projectWithTwoClips();
    const local = updateClip(baseline, asId("a"), (item) => ({ ...item, label: "local" }));
    const remote = updateClip(baseline, asId("b"), (item) => ({ ...item, label: "remote" }));
    const delta = diffPendingProject(
      local,
      projectClipJson(baseline),
      projectStructureFingerprint(baseline),
    );

    const merged = mergePendingProject(remote, delta);
    const clips = merged.timeline.tracks.flatMap((track) => track.clips);
    expect(clips.find((item) => item.id === "a")?.label).toBe("local");
    expect(clips.find((item) => item.id === "b")?.label).toBe("remote");
  });

  it("keeps playhead and zoom local when merging a remote snapshot", () => {
    const baseline = projectWithTwoClips();
    const local = {
      ...baseline,
      timeline: { ...baseline.timeline, playhead: 750, zoom: 0.25 },
    };
    const remote = {
      ...baseline,
      timeline: { ...baseline.timeline, playhead: 10, zoom: 0.01 },
    };
    const delta = diffPendingProject(
      local,
      projectClipJson(baseline),
      projectStructureFingerprint(baseline),
    );

    const merged = mergePendingProject(remote, delta);
    expect(merged.timeline.playhead).toBe(750);
    expect(merged.timeline.zoom).toBe(0.25);
  });

  it("treats clip placement changes as structural while clip-body edits remain granular", () => {
    const baseline = projectWithTwoClips();
    const bodyOnly = updateClip(baseline, asId("a"), (item) => ({
      ...item,
      label: "changed",
    }));
    const bodyDelta = diffPendingProject(
      bodyOnly,
      projectClipJson(baseline),
      projectStructureFingerprint(baseline),
    );
    expect(bodyDelta.structure).toBeNull();
    expect(bodyDelta.clips.has("a")).toBe(true);

    const trackId = baseline.timeline.tracks[0]?.id ?? newId();
    const withAddedClip = addClip(baseline, trackId, clip(asId("c"), 2000));
    const structuralDelta = diffPendingProject(
      withAddedClip,
      projectClipJson(baseline),
      projectStructureFingerprint(baseline),
    );
    expect(structuralDelta.structure).not.toBeNull();
  });
});
