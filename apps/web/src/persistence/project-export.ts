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
      tracks: z.array(z.any()),
      playhead: z.number(),
      zoom: z.number(),
      magnetic: z.boolean(),
      duration: z.number(),
    }),
    mediaLibrary: z.array(z.any()),
  }) as unknown as z.ZodType<Project>,
});

export const toProjectExport = (project: Project): ProjectExport => ({
  schema: "cut_editor-project",
  version: PROJECT_VERSION,
  exportedAt: Date.now(),
  project,
});

export const parseProjectExport = (raw: unknown): ProjectExport => exportSchema.parse(raw);

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
