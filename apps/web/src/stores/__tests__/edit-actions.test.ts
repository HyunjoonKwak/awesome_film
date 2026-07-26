import { describe, expect, it } from "vitest";
import type { MediaClip, Project } from "@cut/core";
import { addClip, createEmptyProject, findClip, groupClips, newId } from "@cut/core";
import { useProjectStore } from "../project-store";

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

// Two adjacent clips on V1, one on A1 — the common multi-selection layout.
const setup = () => {
  const p0 = createEmptyProject();
  const [video, audio] = p0.timeline.tracks;
  const a = makeMediaClip(0, 1000);
  const b = makeMediaClip(1000, 1000);
  const c = makeMediaClip(1000, 1000);
  let p: Project = addClip(p0, video!.id, a);
  p = addClip(p, video!.id, b);
  p = addClip(p, audio!.id, c);
  useProjectStore.getState().loadProject(p);
  return { a, b, c, videoTrackId: video!.id };
};

const history = () => useProjectStore.getState().history;
const timeline = () => useProjectStore.getState().project.timeline;

describe("nudgeClipsBy", () => {
  it("keeps adjacent selected clips adjacent when nudging right", () => {
    const { a, b } = setup();

    useProjectStore.getState().nudgeClipsBy([a.id, b.id], 100);

    expect(findClip(timeline(), a.id)!.start).toBe(100);
    expect(findClip(timeline(), b.id)!.start).toBe(1100);
  });

  it("moves a group exactly once when several members are selected", () => {
    const { a, b } = setup();
    const grouped = groupClips(useProjectStore.getState().project, [a.id, b.id]);
    useProjectStore.getState().loadProject(grouped);

    useProjectStore.getState().nudgeClipsBy([a.id, b.id], 100);

    expect(findClip(timeline(), a.id)!.start).toBe(100);
    expect(findClip(timeline(), b.id)!.start).toBe(1100);
  });

  it("records a single undo entry for the whole selection", () => {
    const { a, b } = setup();

    useProjectStore.getState().nudgeClipsBy([a.id, b.id], 100);

    expect(history().past).toHaveLength(1);
    useProjectStore.getState().undo();
    expect(findClip(timeline(), a.id)!.start).toBe(0);
    expect(findClip(timeline(), b.id)!.start).toBe(1000);
  });
});

describe("rippleDeleteClipsById / removeClipsById", () => {
  it("deletes the whole selection as one undo entry", () => {
    const { a, b } = setup();

    useProjectStore.getState().rippleDeleteClipsById([a.id, b.id]);

    expect(timeline().tracks[0]!.clips).toHaveLength(0);
    expect(history().past).toHaveLength(1);
  });

  it("ripple delete pulls the parallel audio track along", () => {
    const { a, c } = setup();

    useProjectStore.getState().rippleDeleteClipsById([a.id]);

    // audio clip that started with clip b (at 1000) follows it to 0
    expect(findClip(timeline(), c.id)!.start).toBe(0);
  });

  it("lift delete leaves other clips in place", () => {
    const { a, b, c } = setup();

    useProjectStore.getState().removeClipsById([a.id]);

    expect(findClip(timeline(), b.id)!.start).toBe(1000);
    expect(findClip(timeline(), c.id)!.start).toBe(1000);
  });
});

describe("pasteClipsAt", () => {
  it("pastes at the target time and records one undo entry", () => {
    const { a, videoTrackId } = setup();

    useProjectStore.getState().pasteClipsAt([{ trackId: videoTrackId, clip: a }], 5000);

    const clips = timeline().tracks[0]!.clips;
    expect(clips).toHaveLength(3);
    expect(clips.some((cl) => cl.start === 5000 && cl.id !== a.id)).toBe(true);
    expect(history().past).toHaveLength(1);
  });

  it("does not record history when nothing can be pasted", () => {
    const { a } = setup();

    useProjectStore.getState().pasteClipsAt([{ trackId: newId(), clip: a }], 5000);

    expect(history().past).toHaveLength(0);
    expect(timeline().tracks[0]!.clips).toHaveLength(2);
  });
});
