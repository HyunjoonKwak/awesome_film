"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  type Project,
  type Clip,
  type MediaAsset,
  type TrackKind,
  type ID,
  type Ms,
  type ShapeKind,
  type ShapeClip,
  type TextClip,
  type TextAnimation,
  type TextAlign,
  createEmptyProject,
  addTrack,
  addClip,
  removeClip,
  rippleDeleteClip,
  closeGapsOnTrack,
  groupClips,
  ungroupClips,
  moveClipOrGroup,
  slipClip,
  rollEdit,
  slideClip,
  crossfadeWithPrevious,
  detachAudio,
  setClipFreeze,
  toggleClipDisabled,
  trimClipEnd,
  trimClipStart,
  splitClipAt,
  setPlayhead,
  setZoom,
  emptyHistory,
  runCommand,
  undo as undoHistory,
  redo as redoHistory,
  type CommandHistory,
  findClip,
  newId,
  snapClipStart,
  updateClip,
  setClipTransform,
  setClipMask,
  setClipBlendMode,
  setTransitionIn,
  setTransitionOut,
  duplicateClip,
  createMulticamProgram,
  switchAngleAt,
  type MulticamAngle,
  type Marker,
  type ClipTransform,
  type ClipMask,
  type BlendMode,
  type SpatialFit,
  type Transition,
  type EasingFn,
  type BezierHandles,
  type KeyframeTrack,
} from "@cut/core";
import { createMarkerActions } from "./actions/marker-actions";
import { createKeyframeActions } from "./actions/keyframe-actions";
import { createTrackActions } from "./actions/track-actions";
import { createMediaActions } from "./actions/media-actions";
import { createEffectActions } from "./actions/effect-actions";

export type TitleTemplate = "title" | "subtitle" | "lowerThird";

interface ProjectStoreState {
  project: Project;
  history: CommandHistory;

  // mutations
  loadProject: (p: Project) => void;
  renameProject: (name: string) => void;
  setResolution: (w: number, h: number) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (assetId: ID) => void;
  setAssetProxy: (assetId: ID, proxy: { proxyPath: string; proxyWidth: number; proxyHeight: number }) => void;
  addNewTrack: (kind: TrackKind) => void;
  addTextClipAtPlayhead: (text?: string) => void;
  addShapeClipAtPlayhead: (shape: ShapeKind) => void;
  addAdjustmentClipAtPlayhead: () => void;
  addTitleTemplate: (kind: TitleTemplate) => void;
  updateShapeClip: (clipId: ID, patch: Partial<Pick<ShapeClip, "shape" | "fill" | "stroke" | "strokeWidth" | "cornerRadius" | "fillType" | "fillColor2" | "gradientAngle">>) => void;
  updateTextClip: (clipId: ID, patch: { text?: string; size?: number; color?: string; bgColor?: string | undefined; font?: string; weight?: number; align?: TextAlign; strokeColor?: string; strokeWidth?: number; shadow?: boolean; shadowBlur?: number; animIn?: string; animOut?: string; animMs?: number }) => void;
  removeTrackById: (trackId: ID) => void;
  toggleTrackMute: (trackId: ID) => void;
  toggleTrackLock: (trackId: ID) => void;
  toggleTrackSolo: (trackId: ID) => void;
  addClipToTrack: (trackId: ID, clip: Clip) => void;
  removeClipById: (clipId: ID) => void;
  rippleDeleteById: (clipId: ID) => void;
  closeGapsForClip: (clipId: ID) => void;
  slipClipBy: (clipId: ID, deltaMs: Ms) => void;
  rollEditBy: (clipId: ID, deltaMs: Ms) => void;
  slideClipBy: (clipId: ID, deltaMs: Ms) => void;
  crossfadeWith: (clipId: ID, durationMs?: Ms) => void;
  detachAudioFrom: (clipId: ID) => void;
  upsertEffectFor: (clipId: ID, type: string, params: Record<string, number | string | boolean>) => void;
  toggleClipDisabledById: (clipId: ID) => void;
  toggleFreezeAtPlayhead: (clipId: ID) => void;
  moveClipBy: (clipId: ID, deltaMs: Ms) => void;
  groupSelected: (clipIds: readonly ID[]) => void;
  ungroupClip: (clipId: ID) => void;
  moveClipToOtherTrack: (clipId: ID, destTrackId: ID) => void;
  trimEnd: (clipId: ID, newEnd: Ms) => void;
  trimStart: (clipId: ID, newStart: Ms) => void;
  splitAt: (clipId: ID, at: Ms) => void;
  setTransform: (clipId: ID, patch: Partial<ClipTransform>) => void;
  setMask: (clipId: ID, mask: ClipMask | undefined) => void;
  setBlendMode: (clipId: ID, mode: BlendMode | undefined) => void;
  createMulticam: (angles: readonly MulticamAngle[], durationMs: Ms) => void;
  switchMulticamAngle: (atMs: Ms, angle: MulticamAngle) => void;
  setTransitionInFor: (clipId: ID, transition: Transition | undefined) => void;
  setTransitionOutFor: (clipId: ID, transition: Transition | undefined) => void;
  duplicateClipById: (clipId: ID) => void;
  reorderEffectById: (clipId: ID, effectId: ID, toIndex: number) => void;
  addMarkerAt: (atMs: Ms, label?: string) => void;
  removeMarkerById: (markerId: ID) => void;
  updateMarkerById: (markerId: ID, patch: Partial<Omit<Marker, "id">>) => void;
  addKeyframe: (clipId: ID, target: string, atMs: Ms, value: number) => void;
  removeKeyframe: (clipId: ID, target: string, atMs: Ms) => void;
  clearKeyframeTrack: (clipId: ID, target: string) => void;
  pasteKeyframesTo: (clipId: ID, tracks: readonly KeyframeTrack[]) => void;
  setKeyframeEasing: (clipId: ID, target: string, atMs: Ms, easing: EasingFn, bezier?: BezierHandles) => void;
  setClipSpeed: (clipId: ID, speed: number) => void;
  setClipVolume: (clipId: ID, volume: number) => void;
  setClipFit: (clipId: ID, fit: SpatialFit) => void;
  addEffect: (clipId: ID, type: string) => void;
  removeEffect: (clipId: ID, effectId: ID) => void;
  setEffectParamValue: (clipId: ID, effectId: ID, key: string, value: number | string | boolean) => void;
  toggleEffect: (clipId: ID, effectId: ID) => void;
  setPlayheadMs: (ms: Ms) => void;
  setZoomLevel: (zoom: number) => void;

  // history
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const runWith = (
  set: (fn: (s: ProjectStoreState) => Partial<ProjectStoreState>) => void,
  label: string,
  fn: (p: Project) => Project,
) => {
  set((s) => {
    const { project, history } = runCommand(s.project, s.history, { label, apply: fn });
    return { project, history };
  });
};

export const useProjectStore = create<ProjectStoreState>()(
  subscribeWithSelector((set, get) => ({
    project: createEmptyProject(),
    history: emptyHistory,

    loadProject: (p) => set({ project: p, history: emptyHistory }),

    renameProject: (name) =>
      runWith(set, "Rename project", (p) => ({ ...p, name: name.slice(0, 80) || "Untitled" })),

    setResolution: (w, h) =>
      runWith(set, "Reframe project", (p) => ({
        ...p,
        resolution: { w: Math.max(16, Math.round(w)), h: Math.max(16, Math.round(h)) },
      })),

    ...createMediaActions(set),
    ...createTrackActions(set),
    ...createMarkerActions(set),
    ...createKeyframeActions(set),
    ...createEffectActions(set),

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

    moveClipBy: (clipId, deltaMs) =>
      runWith(set, "Move clip", (p) => {
        const clip = findClip(p.timeline, clipId);
        if (!clip) return p;
        const candidate = Math.max(0, clip.start + deltaMs);
        // Snap tolerance: 8px in current zoom (frames are ~33ms @ 30fps)
        const toleranceMs = 8 / Math.max(p.timeline.zoom, 0.001);
        const snapped = snapClipStart(p.timeline, clip, candidate, { toleranceMs });
        // Grouped clips move rigidly together by the snapped delta.
        if (clip.groupId) return moveClipOrGroup(p, clipId, snapped - clip.start);
        return updateClip(p, clipId, (c) => ({ ...c, start: snapped }));
      }),

    groupSelected: (clipIds) =>
      runWith(set, "Group clips", (p) => groupClips(p, clipIds)),

    ungroupClip: (clipId) =>
      runWith(set, "Ungroup clips", (p) => ungroupClips(p, clipId)),

    removeClipById: (clipId) =>
      runWith(set, "Delete clip", (p) => removeClip(p, clipId)),

    rippleDeleteById: (clipId) =>
      runWith(set, "Ripple delete", (p) => rippleDeleteClip(p, clipId)),

    closeGapsForClip: (clipId) =>
      runWith(set, "Close gaps", (p) => {
        const track = p.timeline.tracks.find((t) => t.clips.some((c) => c.id === clipId));
        return track ? closeGapsOnTrack(p, track.id) : p;
      }),

    trimEnd: (clipId, newEnd) =>
      runWith(set, "Trim clip", (p) => trimClipEnd(p, clipId, newEnd)),

    trimStart: (clipId, newStart) =>
      runWith(set, "Trim clip", (p) => trimClipStart(p, clipId, newStart)),

    rollEditBy: (clipId, deltaMs) =>
      runWith(set, "Roll edit", (p) => rollEdit(p, clipId, deltaMs)),

    slideClipBy: (clipId, deltaMs) =>
      runWith(set, "Slide clip", (p) => slideClip(p, clipId, deltaMs)),

    crossfadeWith: (clipId, durationMs = 500) =>
      runWith(set, "Audio crossfade", (p) => crossfadeWithPrevious(p, clipId, durationMs)),

    detachAudioFrom: (clipId) =>
      runWith(set, "Detach audio", (p) => detachAudio(p, clipId)),

    slipClipBy: (clipId, deltaMs) =>
      // No history entry for smooth slider drags; mirrors setTransform.
      set((s) => {
        const clip = s.project.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
        const asset =
          clip && clip.kind === "media"
            ? s.project.mediaLibrary.find((a) => a.id === clip.assetId)
            : undefined;
        const maxSource = asset?.durationMs ?? Number.POSITIVE_INFINITY;
        return { project: slipClip(s.project, clipId, deltaMs, maxSource) };
      }),

    toggleClipDisabledById: (clipId) =>
      runWith(set, "Toggle clip", (p) => toggleClipDisabled(p, clipId)),

    toggleFreezeAtPlayhead: (clipId) =>
      runWith(set, "Freeze frame", (p) => {
        const clip = p.timeline.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
        if (!clip || clip.kind !== "media") return p;
        if (clip.freeze !== undefined) return setClipFreeze(p, clipId, undefined);
        const srcMs = clip.trimIn + (p.timeline.playhead - clip.start) * clip.speed;
        const held = Math.max(clip.trimIn, Math.min(srcMs, clip.trimOut));
        return setClipFreeze(p, clipId, held);
      }),

    splitAt: (clipId, at) =>
      runWith(set, "Split clip", (p) => splitClipAt(p, clipId, at)),

    setTransform: (clipId, patch) =>
      // Skip history entry for smooth slider drags.
      set((s) => ({ project: setClipTransform(s.project, clipId, patch) })),

    setMask: (clipId, mask) =>
      runWith(set, "Set mask", (p) => setClipMask(p, clipId, mask)),

    setBlendMode: (clipId, mode) =>
      runWith(set, "Set blend mode", (p) => setClipBlendMode(p, clipId, mode)),

    createMulticam: (angles, durationMs) =>
      runWith(set, "Create multicam", (p) => createMulticamProgram(p, angles, durationMs).project),
    switchMulticamAngle: (atMs, angle) =>
      runWith(set, "Switch angle", (p) => switchAngleAt(p, atMs, angle)),

    setTransitionInFor: (clipId, transition) =>
      runWith(set, "Set transition in", (p) => setTransitionIn(p, clipId, transition)),
    setTransitionOutFor: (clipId, transition) =>
      runWith(set, "Set transition out", (p) => setTransitionOut(p, clipId, transition)),

    duplicateClipById: (clipId) =>
      runWith(set, "Duplicate clip", (p) => duplicateClip(p, clipId)),

    setClipSpeed: (clipId, speed) =>
      runWith(set, "Set speed", (p) =>
        updateClip(p, clipId, (c) => ({ ...c, speed: Math.max(0.1, speed) })),
      ),

    setClipFit: (clipId, fit) =>
      runWith(set, "Set fit", (p) =>
        updateClip(p, clipId, (c) => (c.kind === "media" ? { ...c, fit } : c)),
      ),

    setClipVolume: (clipId, volume) =>
      // No history entry for smooth slider drags.
      set((s) => ({
        project: updateClip(s.project, clipId, (c) =>
          c.kind === "media" ? { ...c, volume: Math.max(0, Math.min(4, volume)) } : c,
        ),
      })),

    // Playhead and zoom are transient — no history entry to avoid bloat.
    setPlayheadMs: (ms) => set((s) => ({ project: setPlayhead(s.project, ms) })),
    setZoomLevel: (zoom) => set((s) => ({ project: setZoom(s.project, zoom) })),

    undo: () =>
      set((s) => {
        const r = undoHistory(s.project, s.history);
        return { project: r.project, history: r.history };
      }),
    redo: () =>
      set((s) => {
        const r = redoHistory(s.project, s.history);
        return { project: r.project, history: r.history };
      }),
    canUndo: () => get().history.past.length > 0,
    canRedo: () => get().history.future.length > 0,
  })),
);

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __cutStore: typeof useProjectStore }).__cutStore = useProjectStore;
}

// convenient memo-less selectors
export const selectPlayhead = (s: ProjectStoreState): Ms => s.project.timeline.playhead;
export const selectZoom = (s: ProjectStoreState): number => s.project.timeline.zoom;
export const selectDuration = (s: ProjectStoreState): Ms => s.project.timeline.duration;
