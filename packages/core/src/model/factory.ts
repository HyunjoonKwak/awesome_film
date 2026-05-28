import type { Project } from "./project";
import type { Track } from "./track";
import { newId } from "../utils/id";

export const createEmptyProject = (overrides?: Partial<Project>): Project => {
  const now = Date.now();
  const videoTrack: Track = {
    id: newId(),
    kind: "video",
    name: "V1",
    height: 60,
    muted: false,
    solo: false,
    locked: false,
    clips: [],
  };
  const audioTrack: Track = {
    id: newId(),
    kind: "audio",
    name: "A1",
    height: 48,
    muted: false,
    solo: false,
    locked: false,
    clips: [],
  };
  return {
    id: newId(),
    name: "Untitled",
    createdAt: now,
    updatedAt: now,
    framerate: 30,
    resolution: { w: 1920, h: 1080 },
    timeline: {
      tracks: [videoTrack, audioTrack],
      playhead: 0,
      zoom: 0.05, // 50 px per second by default
      magnetic: true,
      duration: 0,
    },
    mediaLibrary: [],
    ...overrides,
  };
};
