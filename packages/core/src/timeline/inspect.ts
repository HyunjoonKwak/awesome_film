import type { Project } from "../model/project";
import { clipEnd, isMediaClip } from "../model/clip";

export type IssueSeverity = "error" | "warning" | "info";

export interface ProjectIssue {
  readonly severity: IssueSeverity;
  readonly code: string;
  readonly message: string;
  readonly clipId?: string;
}

// Static project linter: flags problems that would otherwise surface only at
// export time (offline media, empty timeline, gaps, possible audio clipping).
// Pure and synchronous so it can run on every render.
export const inspectProject = (project: Project): readonly ProjectIssue[] => {
  const issues: ProjectIssue[] = [];
  const assetIds = new Set(project.mediaLibrary.map((a) => a.id));
  const allClips = project.timeline.tracks.flatMap((t) => t.clips);

  if (allClips.length === 0) {
    issues.push({ severity: "warning", code: "empty-timeline", message: "Timeline has no clips." });
  }

  for (const clip of allClips) {
    if (isMediaClip(clip) && !assetIds.has(clip.assetId)) {
      issues.push({
        severity: "error",
        code: "offline-media",
        message: "Clip references missing media.",
        clipId: clip.id,
      });
    }
    if (clip.duration < 1) {
      issues.push({
        severity: "warning",
        code: "zero-duration",
        message: "Clip has no duration.",
        clipId: clip.id,
      });
    }
    if (isMediaClip(clip) && (clip.volume ?? 1) > 1.5) {
      issues.push({
        severity: "warning",
        code: "loud-clip",
        message: "Clip volume may clip (>150%).",
        clipId: clip.id,
      });
    }
  }

  // Gaps between consecutive clips on each track.
  for (const track of project.timeline.tracks) {
    const sorted = [...track.clips].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i]!.start - clipEnd(sorted[i - 1]!);
      if (gap > 2) {
        issues.push({
          severity: "info",
          code: "gap",
          message: `Gap of ${Math.round(gap)}ms on "${track.name}".`,
        });
      }
    }
  }

  return issues;
};
