"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/stores/project-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useViewStore } from "@/stores/view-store";
import { useRangeStore } from "@/stores/range-store";

const isEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const cmd = e.metaKey || e.ctrlKey;

      // undo / redo
      if (cmd && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        useProjectStore.getState().undo();
        return;
      }
      if ((cmd && e.shiftKey && e.key.toLowerCase() === "z") || (cmd && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }

      // playback
      if (e.code === "Space") {
        e.preventDefault();
        usePlaybackStore.getState().toggle();
        return;
      }

      // J/K/L shuttle: K pauses, L plays forward (tap again to speed up),
      // J plays in reverse (tap again to speed up). Rate caps at ±8×.
      if (e.key === "l" && !cmd) {
        const pb = usePlaybackStore.getState();
        const rate = pb.playing && pb.rate > 0 ? Math.min(pb.rate * 2, 8) : 1;
        pb.setRate(rate);
        pb.setPlaying(true);
        return;
      }
      if (e.key === "j" && !cmd) {
        const pb = usePlaybackStore.getState();
        const rate = pb.playing && pb.rate < 0 ? Math.max(pb.rate * 2, -8) : -1;
        pb.setRate(rate);
        pb.setPlaying(true);
        return;
      }
      if (e.key === "k" && !cmd) {
        const pb = usePlaybackStore.getState();
        pb.setPlaying(false);
        pb.setRate(1);
        return;
      }

      // `m` — drop a marker at the playhead.
      if (e.key === "m" && !cmd) {
        const store = useProjectStore.getState();
        store.addMarkerAt(store.project.timeline.playhead);
        return;
      }

      // Cmd/Ctrl+B — blade: split every clip under the playhead, all tracks.
      if (cmd && e.key.toLowerCase() === "b") {
        e.preventDefault();
        const store = useProjectStore.getState();
        store.splitAllAt(store.project.timeline.playhead);
        return;
      }

      // Home / End — jump the playhead to the start / end of the timeline.
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        const store = useProjectStore.getState();
        store.setPlayheadMs(e.key === "Home" ? 0 : store.project.timeline.duration);
        return;
      }

      // `,` / `.` — jump to the previous / next marker.
      if ((e.key === "," || e.key === ".") && !cmd) {
        const proj = useProjectStore.getState().project;
        const markers = proj.timeline.markers ?? [];
        if (markers.length === 0) return;
        const at = proj.timeline.playhead;
        const sorted = [...markers].sort((a, b) => a.at - b.at);
        const target =
          e.key === "."
            ? sorted.find((m) => m.at > at + 1)
            : [...sorted].reverse().find((m) => m.at < at - 1);
        if (target) useProjectStore.getState().setPlayheadMs(target.at);
        return;
      }

      // delete (Shift = ripple delete: close the gap behind each clip)
      if (e.key === "Backspace" || e.key === "Delete") {
        const ids = useSelectionStore.getState().clipIds;
        if (ids.size > 0) {
          e.preventDefault();
          const store = useProjectStore.getState();
          for (const id of ids) {
            if (e.shiftKey) store.rippleDeleteById(id);
            else store.removeClipById(id);
          }
          useSelectionStore.getState().clear();
        }
      }

      // in/out work-area points for ranged export — `i` / `o`
      if (e.key === "i" && !cmd) {
        useRangeStore.getState().setIn(useProjectStore.getState().project.timeline.playhead);
        return;
      }
      if (e.key === "o" && !cmd) {
        useRangeStore.getState().setOut(useProjectStore.getState().project.timeline.playhead);
        return;
      }

      // razor split at playhead — `s`
      if (e.key === "s" && !cmd) {
        const ids = useSelectionStore.getState().clipIds;
        const at = useProjectStore.getState().project.timeline.playhead;
        const store = useProjectStore.getState();
        for (const id of ids) store.splitAt(id, at);
      }

      // Cmd/Ctrl+G — group selected clips; +Shift ungroups.
      if (cmd && e.key.toLowerCase() === "g") {
        e.preventDefault();
        const ids = [...useSelectionStore.getState().clipIds];
        const store = useProjectStore.getState();
        if (e.shiftKey) {
          for (const id of ids) store.ungroupClip(id);
        } else if (ids.length >= 2) {
          store.groupSelected(ids);
        }
        return;
      }

      // Cmd/Ctrl+A — select every clip on every track
      if (cmd && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const all = useProjectStore.getState().project.timeline.tracks.flatMap((t) =>
          t.clips.map((c) => c.id),
        );
        useSelectionStore.setState({ clipIds: new Set(all) });
      }

      // Arrow left/right. With a selection: clip edits — plain = nudge
      // (Shift = 1s), Alt = roll the cut with the next clip, Alt+Shift =
      // slide between neighbours. Without a selection: FCP-style playhead
      // frame stepping (Shift = 1s).
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const ids = useSelectionStore.getState().clipIds;
        const store = useProjectStore.getState();
        const fps = store.project.framerate;
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        if (ids.size > 0) {
          if (e.altKey && e.shiftKey) {
            const delta = dir * (1000 / fps) * 5;
            for (const id of ids) store.slideClipBy(id, delta);
          } else if (e.altKey) {
            const delta = dir * (1000 / fps) * 5;
            for (const id of ids) store.rollEditBy(id, delta);
          } else {
            const delta = dir * (e.shiftKey ? 1000 : 1000 / fps);
            for (const id of ids) store.moveClipBy(id, delta);
          }
        } else {
          const delta = dir * (e.shiftKey ? 1000 : 1000 / fps);
          store.setPlayheadMs(store.project.timeline.playhead + delta);
        }
        return;
      }

      // `?` — toggle the keyboard shortcut cheatsheet
      if (e.key === "?") {
        e.preventDefault();
        useViewStore.getState().toggleShortcuts();
        return;
      }

      // Esc — clear selection and close the cheatsheet
      if (e.key === "Escape") {
        useViewStore.getState().setShowShortcuts(false);
        useSelectionStore.getState().clear();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
};
