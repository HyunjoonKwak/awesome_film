"use client";

import { useEffect } from "react";
import { usePlaybackStore } from "@/stores/playback-store";
import { useProjectStore } from "@/stores/project-store";
import { getAudioEngine } from "./audio-engine";

// Bridges the playback store to the audio engine: start monitoring from the
// current playhead when play begins (or the rate changes), stop on pause.
// Playhead advances are intentionally NOT a dependency — the engine schedules
// once from the start position and the AudioContext clock carries it, in step
// with the rAF picture loop in PreviewViewport.
export function useAudioPlayback(): void {
  const playing = usePlaybackStore((s) => s.playing);
  const rate = usePlaybackStore((s) => s.rate);

  useEffect(() => {
    const engine = getAudioEngine();
    if (playing) {
      const { project } = useProjectStore.getState();
      void engine.play(project, project.timeline.playhead, rate);
    } else {
      engine.stop();
    }
    return () => engine.stop();
  }, [playing, rate]);
}
