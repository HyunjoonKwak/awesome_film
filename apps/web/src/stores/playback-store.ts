"use client";

import { create } from "zustand";

interface PlaybackState {
  playing: boolean;
  rate: number;
  setPlaying: (v: boolean) => void;
  toggle: () => void;
  setRate: (r: number) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  playing: false,
  rate: 1,
  setPlaying: (playing) => set({ playing }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  setRate: (rate) => set({ rate }),
}));
