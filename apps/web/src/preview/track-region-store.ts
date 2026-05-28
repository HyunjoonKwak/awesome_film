"use client";

import { create } from "zustand";

export interface NormalizedRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TrackRegionState {
  // Active when the user is in "select tracking region" mode.
  selecting: boolean;
  region: NormalizedRegion | null;
  setSelecting: (v: boolean) => void;
  setRegion: (r: NormalizedRegion | null) => void;
}

export const useTrackRegionStore = create<TrackRegionState>((set) => ({
  selecting: false,
  region: null,
  setSelecting: (selecting) => set({ selecting }),
  setRegion: (region) => set({ region }),
}));
