import type { Clip, Project } from "@cut/core";

export interface PendingProjectDelta {
  readonly clips: ReadonlyMap<string, Clip | null>;
  readonly structure: Project | null;
  readonly playhead: number;
  readonly zoom: number;
}

export const projectClipJson = (project: Project): Map<string, string> =>
  new Map(
    project.timeline.tracks.flatMap((track) =>
      track.clips.map((clip) => [clip.id, JSON.stringify(clip)] as const),
    ),
  );

// Fingerprint only state that should be shared between collaborators. Playhead
// and zoom are local view state (awareness broadcasts the cursor separately),
// while duration is derived from clip bodies and updatedAt is bookkeeping.
export const projectStructureFingerprint = (project: Project): string =>
  JSON.stringify({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    framerate: project.framerate,
    resolution: project.resolution,
    mediaLibrary: project.mediaLibrary,
    timeline: {
      magnetic: project.timeline.magnetic,
      markers: project.timeline.markers ?? [],
      tracks: project.timeline.tracks.map(({ clips, ...track }) => ({
        ...track,
        clipIds: clips.map((clip) => clip.id),
      })),
    },
  });

export const diffPendingProject = (
  local: Project,
  baselineClips: ReadonlyMap<string, string>,
  baselineStructureFingerprint: string,
): PendingProjectDelta => {
  const localClips = new Map<string, Clip>();
  const clips = new Map<string, Clip | null>();

  for (const track of local.timeline.tracks) {
    for (const clip of track.clips) {
      localClips.set(clip.id, clip);
      if (baselineClips.get(clip.id) !== JSON.stringify(clip)) clips.set(clip.id, clip);
    }
  }
  for (const id of baselineClips.keys()) {
    if (!localClips.has(id)) clips.set(id, null);
  }

  return {
    clips,
    structure: projectStructureFingerprint(local) === baselineStructureFingerprint ? null : local,
    playhead: local.timeline.playhead,
    zoom: local.timeline.zoom,
  };
};

// Apply unsent local changes over a freshly received remote snapshot. Different
// clip bodies merge independently; structural changes intentionally remain
// last-writer-wins until tracks/clip ordering move to native Y.Array values.
export const mergePendingProject = (remote: Project, delta: PendingProjectDelta): Project => {
  const structure = delta.structure ?? remote;
  const bodies = new Map<string, Clip>();
  for (const track of remote.timeline.tracks) {
    for (const clip of track.clips) bodies.set(clip.id, clip);
  }
  for (const [id, clip] of delta.clips) {
    if (clip) bodies.set(id, clip);
    else bodies.delete(id);
  }

  const tracks = structure.timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips
      .map((clip) => bodies.get(clip.id) ?? (delta.structure ? clip : undefined))
      .filter((clip): clip is Clip => clip !== undefined),
  }));
  const duration = tracks.reduce(
    (max, track) =>
      track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.start + clip.duration), max),
    0,
  );

  return {
    ...structure,
    timeline: {
      ...structure.timeline,
      tracks,
      duration,
      playhead: delta.playhead,
      zoom: delta.zoom,
    },
  };
};
