import { describe, expect, it } from "vitest";
import type { MediaClip } from "../../model/clip";
import { createEmptyProject } from "../../model/factory";
import { newId } from "../../utils/id";
import { addClip, groupClips, pasteClips } from "../mutate";
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

describe("pasteClips", () => {
  it("pastes a copy with a fresh id at the target time", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeMediaClip(0, 1000);
    const p1 = addClip(p0, tid, clip);

    const p2 = pasteClips(p1, [{ trackId: tid, clip }], 5000);

    const clips = p2.timeline.tracks[0]!.clips;
    expect(clips).toHaveLength(2);
    const pasted = clips.find((c) => c.id !== clip.id)!;
    expect(pasted.start).toBe(5000);
    expect(pasted.duration).toBe(1000);
    // original untouched
    expect(findClip(p2.timeline, clip.id)!.start).toBe(0);
    expect(p2.timeline.duration).toBe(6000);
  });

  it("preserves relative offsets across clips and tracks", () => {
    const p0 = createEmptyProject();
    const [video, audio] = p0.timeline.tracks;
    const a = makeMediaClip(1000, 500);
    const b = makeMediaClip(2000, 1000);
    let p = addClip(p0, video!.id, a);
    p = addClip(p, audio!.id, b);

    const p2 = pasteClips(
      p,
      [
        { trackId: video!.id, clip: a },
        { trackId: audio!.id, clip: b },
      ],
      10_000,
    );

    const pastedVideo = p2.timeline.tracks[0]!.clips.find((c) => c.id !== a.id)!;
    const pastedAudio = p2.timeline.tracks[1]!.clips.find((c) => c.id !== b.id)!;
    expect(pastedVideo.start).toBe(10_000);
    expect(pastedAudio.start).toBe(11_000);
  });

  it("strips group membership from pasted clips", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const a = makeMediaClip(0, 1000);
    const b = makeMediaClip(1000, 1000);
    let p = addClip(p0, tid, a);
    p = addClip(p, tid, b);
    p = groupClips(p, [a.id, b.id]);
    const grouped = p.timeline.tracks[0]!.clips;
    expect(grouped.every((c) => c.groupId)).toBe(true);

    const p2 = pasteClips(
      p,
      grouped.map((clip) => ({ trackId: tid, clip })),
      5000,
    );

    const pasted = p2.timeline.tracks[0]!.clips.filter(
      (c) => c.id !== a.id && c.id !== b.id,
    );
    expect(pasted).toHaveLength(2);
    expect(pasted.every((c) => c.groupId === undefined)).toBe(true);
  });

  it("clamps into a free gap instead of overlapping existing clips", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const existing = makeMediaClip(0, 2000);
    const p1 = addClip(p0, tid, existing);

    const p2 = pasteClips(p1, [{ trackId: tid, clip: existing }], 1000);

    const pasted = p2.timeline.tracks[0]!.clips.find((c) => c.id !== existing.id)!;
    expect(pasted.start).toBe(2000);
  });

  it("ignores entries whose track no longer exists", () => {
    const p0 = createEmptyProject();
    const clip = makeMediaClip(0, 1000);

    const p1 = pasteClips(p0, [{ trackId: newId(), clip }], 0);

    expect(p1).toBe(p0);
  });

  it("skips locked tracks", () => {
    const p0 = createEmptyProject();
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeMediaClip(0, 1000);
    const p1 = addClip(p0, tid, clip);
    const locked = {
      ...p1,
      timeline: {
        ...p1.timeline,
        tracks: p1.timeline.tracks.map((t) => (t.id === tid ? { ...t, locked: true } : t)),
      },
    };

    const p2 = pasteClips(locked, [{ trackId: tid, clip }], 5000);

    expect(p2).toBe(locked);
  });

  it("snaps the paste position to the frame grid", () => {
    // 25fps → 40ms frames, so 1015 rounds to frame 25 = 1000.
    const p0 = createEmptyProject({ framerate: 25 });
    const tid = p0.timeline.tracks[0]!.id;
    const clip = makeMediaClip(0, 1000);
    const p1 = addClip(p0, tid, clip);

    const p2 = pasteClips(p1, [{ trackId: tid, clip }], 1015);

    const pasted = p2.timeline.tracks[0]!.clips.find((c) => c.id !== clip.id)!;
    expect(pasted.start).toBe(1000);
  });
});
