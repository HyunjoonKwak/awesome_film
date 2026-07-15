import {
  addClip,
  addTrack,
  newId,
  updateClip,
  type ID,
  type ShapeClip,
  type ShapeKind,
  type TextAlign,
  type TextAnimation,
} from "@cut/core";
import { runWith, type ProjectMutating, type SetFn } from "../store-helpers";

// Which built-in title layout to drop at the playhead.
export type TitleTemplate = "title" | "subtitle" | "lowerThird";

// Text / shape / adjustment clip creation plus inline text & shape editing.
// Extracted from project-store so that file stays focused on timeline editing,
// drag sessions, and history. All actions route through `runWith`, so undo /
// redo and collaboration stay free.
export interface ClipCreateActions {
  addTextClipAtPlayhead: (text?: string) => void;
  addTitleTemplate: (kind: TitleTemplate) => void;
  updateTextClip: (
    clipId: ID,
    patch: {
      text?: string;
      size?: number;
      color?: string;
      bgColor?: string | undefined;
      font?: string;
      weight?: number;
      align?: TextAlign;
      strokeColor?: string;
      strokeWidth?: number;
      shadow?: boolean;
      shadowBlur?: number;
      animIn?: string;
      animOut?: string;
      animMs?: number;
    },
  ) => void;
  addShapeClipAtPlayhead: (shape: ShapeKind) => void;
  addAdjustmentClipAtPlayhead: () => void;
  updateShapeClip: (
    clipId: ID,
    patch: Partial<
      Pick<
        ShapeClip,
        | "shape"
        | "fill"
        | "stroke"
        | "strokeWidth"
        | "cornerRadius"
        | "fillType"
        | "fillColor2"
        | "gradientAngle"
      >
    >,
  ) => void;
}

export const createClipCreateActions = <S extends ProjectMutating>(
  set: SetFn<S>,
): ClipCreateActions => ({
  addTextClipAtPlayhead: (text = "Title") =>
    runWith(set, "Add text", (p) => {
      // Pick (or create) the first text/overlay track.
      let textTrack = p.timeline.tracks.find((t) => t.kind === "text");
      let projectAfter = p;
      if (!textTrack) {
        projectAfter = addTrack(p, {
          kind: "text",
          name: `T${p.timeline.tracks.filter((t) => t.kind === "text").length + 1}`,
          height: 48,
          muted: false,
          solo: false,
          locked: false,
        });
        textTrack = projectAfter.timeline.tracks.at(-1)!;
      }
      return addClip(projectAfter, textTrack.id, {
        kind: "text",
        id: newId(),
        start: projectAfter.timeline.playhead,
        duration: 3000,
        speed: 1,
        effects: [],
        keyframes: [],
        text,
        font: "Inter, system-ui, sans-serif",
        size: 96,
        color: "#ffffff",
      });
    }),

  addTitleTemplate: (kind) =>
    runWith(set, "Add title template", (p) => {
      const at = p.timeline.playhead;
      // Resolve (or create) an overlay/video track to hold the template.
      let track = [...p.timeline.tracks].reverse().find((t) => t.kind === "overlay" || t.kind === "video");
      let proj = p;
      if (!track) {
        proj = addTrack(p, { kind: "overlay", name: "FX", height: 60, muted: false, solo: false, locked: false });
        track = proj.timeline.tracks.at(-1)!;
      }
      const baseText = {
        kind: "text" as const,
        start: at,
        duration: 4000,
        speed: 1,
        effects: [],
        keyframes: [],
        font: "Inter, system-ui, sans-serif",
        color: "#ffffff",
        animMs: 500,
      };
      if (kind === "title") {
        return addClip(proj, track.id, {
          ...baseText,
          id: newId(),
          text: "Title",
          size: 112,
          align: "center",
          animIn: "fade",
          animOut: "fade",
          transform: { x: 0, y: 0.05, scale: 1, rotation: 0, opacity: 1 },
        });
      }
      if (kind === "subtitle") {
        return addClip(proj, track.id, {
          ...baseText,
          id: newId(),
          text: "Subtitle",
          size: 46,
          align: "center",
          animIn: "fade",
          animOut: "fade",
          transform: { x: 0, y: -0.72, scale: 1, rotation: 0, opacity: 1 },
        });
      }
      // lower-third: a semi-transparent backing bar plus left-aligned text.
      const withBar = addClip(proj, track.id, {
        kind: "shape",
        id: newId(),
        start: at,
        duration: 4000,
        speed: 1,
        effects: [],
        keyframes: [],
        shape: "rect",
        fill: "rgba(0,0,0,0.55)",
        stroke: "transparent",
        strokeWidth: 0,
        cornerRadius: 12,
        transform: { x: -0.12, y: -0.58, scale: 0.6, rotation: 0, opacity: 1 },
      });
      return addClip(withBar, track.id, {
        ...baseText,
        id: newId(),
        text: "Name\nRole / Title",
        size: 40,
        align: "left",
        animIn: "slide-up",
        transform: { x: -0.22, y: -0.58, scale: 1, rotation: 0, opacity: 1 },
      });
    }),

  updateTextClip: (clipId, patch) =>
    runWith(set, "Edit text", (p) =>
      updateClip(p, clipId, (c) =>
        c.kind === "text"
          ? {
              ...c,
              ...(patch.text !== undefined ? { text: patch.text } : {}),
              ...(patch.size !== undefined ? { size: patch.size } : {}),
              ...(patch.color !== undefined ? { color: patch.color } : {}),
              ...(patch.bgColor !== undefined ? { bgColor: patch.bgColor } : {}),
              ...(patch.font !== undefined ? { font: patch.font } : {}),
              ...(patch.weight !== undefined ? { weight: patch.weight } : {}),
              ...(patch.align !== undefined ? { align: patch.align } : {}),
              ...(patch.strokeColor !== undefined ? { strokeColor: patch.strokeColor } : {}),
              ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}),
              ...(patch.shadow !== undefined ? { shadow: patch.shadow } : {}),
              ...(patch.shadowBlur !== undefined ? { shadowBlur: patch.shadowBlur } : {}),
              ...(patch.animIn !== undefined ? { animIn: patch.animIn as TextAnimation } : {}),
              ...(patch.animOut !== undefined ? { animOut: patch.animOut as TextAnimation } : {}),
              ...(patch.animMs !== undefined ? { animMs: patch.animMs } : {}),
            }
          : c,
      ),
    ),

  addShapeClipAtPlayhead: (shape) =>
    runWith(set, "Add shape", (p) => {
      let track = p.timeline.tracks.find((t) => t.kind === "overlay" || t.kind === "video");
      let projectAfter = p;
      if (!track) {
        projectAfter = addTrack(p, {
          kind: "video",
          name: "V1",
          height: 60,
          muted: false,
          solo: false,
          locked: false,
        });
        track = projectAfter.timeline.tracks.at(-1)!;
      }
      return addClip(projectAfter, track.id, {
        kind: "shape",
        id: newId(),
        start: projectAfter.timeline.playhead,
        duration: 3000,
        speed: 1,
        effects: [],
        keyframes: [],
        shape,
        fill: "#6366f1",
        stroke: "#ffffff",
        strokeWidth: shape === "line" ? 6 : 0,
        ...(shape === "rect" ? { cornerRadius: 0 } : {}),
      });
    }),

  addAdjustmentClipAtPlayhead: () =>
    runWith(set, "Add adjustment layer", (p) => {
      // Adjustment layers belong above the content they grade, so prefer a
      // top overlay track; create one if the project has none.
      let track = [...p.timeline.tracks].reverse().find((t) => t.kind === "overlay" || t.kind === "video");
      let projectAfter = p;
      if (!track) {
        projectAfter = addTrack(p, {
          kind: "overlay",
          name: "FX",
          height: 60,
          muted: false,
          solo: false,
          locked: false,
        });
        track = projectAfter.timeline.tracks.at(-1)!;
      }
      return addClip(projectAfter, track.id, {
        kind: "adjustment",
        id: newId(),
        start: projectAfter.timeline.playhead,
        duration: 3000,
        speed: 1,
        effects: [],
        keyframes: [],
      });
    }),

  updateShapeClip: (clipId, patch) =>
    runWith(set, "Edit shape", (p) =>
      updateClip(p, clipId, (c) =>
        c.kind === "shape"
          ? {
              ...c,
              ...(patch.shape !== undefined ? { shape: patch.shape } : {}),
              ...(patch.fill !== undefined ? { fill: patch.fill } : {}),
              ...(patch.stroke !== undefined ? { stroke: patch.stroke } : {}),
              ...(patch.strokeWidth !== undefined ? { strokeWidth: patch.strokeWidth } : {}),
              ...(patch.cornerRadius !== undefined ? { cornerRadius: patch.cornerRadius } : {}),
              ...(patch.fillType !== undefined ? { fillType: patch.fillType } : {}),
              ...(patch.fillColor2 !== undefined ? { fillColor2: patch.fillColor2 } : {}),
              ...(patch.gradientAngle !== undefined ? { gradientAngle: patch.gradientAngle } : {}),
            }
          : c,
      ),
    ),
});
