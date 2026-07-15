import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@cut/core";
import { parseProjectExport, toProjectExport } from "../project-export";

// The JSON export is the user's escape hatch for their work — a lossy or
// crash-prone round-trip is silent data loss. These guard both directions.
describe("project-export", () => {
  it("survives serialize → JSON → parse with no loss", () => {
    const project = createEmptyProject({ name: "My Film" });
    const json = JSON.stringify(toProjectExport(project));
    const parsed = parseProjectExport(JSON.parse(json));
    expect(parsed.schema).toBe("cut_editor-project");
    expect(parsed.project).toEqual(project);
  });

  it("preserves customized resolution, framerate, and nested tracks", () => {
    const project = createEmptyProject({
      name: "4K 24p",
      framerate: 24,
      resolution: { w: 3840, h: 2160 },
    });
    const parsed = parseProjectExport(JSON.parse(JSON.stringify(toProjectExport(project))));
    expect(parsed.project.framerate).toBe(24);
    expect(parsed.project.resolution).toEqual({ w: 3840, h: 2160 });
    // createEmptyProject seeds a V1 + A1 track pair; both must round-trip.
    expect(parsed.project.timeline.tracks).toHaveLength(2);
    expect(parsed.project.timeline.tracks.map((t) => t.kind)).toEqual(["video", "audio"]);
  });

  it("stamps a numeric version and export timestamp", () => {
    const exported = toProjectExport(createEmptyProject());
    expect(typeof exported.version).toBe("number");
    expect(exported.exportedAt).toBeGreaterThan(0);
  });

  it("rejects a payload with the wrong schema tag", () => {
    expect(() =>
      parseProjectExport({ schema: "definitely-not-us", version: 1, exportedAt: 0, project: {} }),
    ).toThrow();
  });

  it("rejects non-object payloads", () => {
    expect(() => parseProjectExport(null)).toThrow();
    expect(() => parseProjectExport("not json")).toThrow();
    expect(() => parseProjectExport(42)).toThrow();
  });
});
