import { z } from "zod";
import type { Project } from "@cut/core";
import { PROJECT_VERSION } from "@cut/core";

// JSON envelope so we can evolve the on-disk format independently of the
// in-memory Project type.
export interface ProjectExport {
  readonly schema: "cut_editor-project";
  readonly version: number;
  readonly exportedAt: number;
  readonly project: Project;
}

// Structural validation of the load-bearing fields. `.passthrough()` keeps
// optional/extra fields (transforms, keyframes, effect params, proxy paths)
// without enumerating the whole model, while still rejecting a file whose
// tracks/clips/assets are missing their core shape — the gap that previously
// let superficially-valid-but-corrupt files into the store and IndexedDB.
const clipSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    start: z.number(),
    duration: z.number(),
    speed: z.number(),
    effects: z.array(z.unknown()),
    keyframes: z.array(z.unknown()),
  })
  .passthrough();

const trackSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    clips: z.array(clipSchema),
  })
  .passthrough();

const mediaAssetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    mime: z.string(),
    durationMs: z.number(),
    opfsPath: z.string(),
  })
  .passthrough();

const exportSchema = z.object({
  schema: z.literal("cut_editor-project"),
  version: z.number().int(),
  exportedAt: z.number().int(),
  project: z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.number(),
    updatedAt: z.number(),
    framerate: z.number(),
    resolution: z.object({ w: z.number(), h: z.number() }),
    timeline: z.object({
      tracks: z.array(trackSchema),
      playhead: z.number(),
      zoom: z.number(),
      magnetic: z.boolean(),
      duration: z.number(),
    }),
    mediaLibrary: z.array(mediaAssetSchema),
  }) as unknown as z.ZodType<Project>,
});

export const toProjectExport = (project: Project): ProjectExport => ({
  schema: "cut_editor-project",
  version: PROJECT_VERSION,
  exportedAt: Date.now(),
  project,
});

export const parseProjectExport = (raw: unknown): ProjectExport => {
  const env = exportSchema.parse(raw);
  // Refuse a file written by a newer app version rather than silently importing
  // a format we don't understand. Older versions would migrate here; v1 is
  // currently the only version.
  if (env.version > PROJECT_VERSION) {
    throw new Error(
      `This project needs a newer version of the app (file v${env.version}, this app v${PROJECT_VERSION}).`,
    );
  }
  return env;
};

export const downloadProjectJson = (project: Project): void => {
  const json = JSON.stringify(toProjectExport(project), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(project.name)}.cut.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const sanitize = (s: string): string => s.replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 60) || "untitled";
