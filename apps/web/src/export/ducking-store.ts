"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DuckingState {
  // When on, audio-only tracks (music/BGM) duck under video-track audio
  // (dialogue) by `amountDb` whenever the voice bus is active.
  enabled: boolean;
  amountDb: number;     // negative; e.g. -12
  thresholdDb: number;  // voice level above which ducking kicks in
  setEnabled: (v: boolean) => void;
  setAmountDb: (v: number) => void;
  setThresholdDb: (v: number) => void;
}

export const useDuckingStore = create<DuckingState>()(
  persist(
    (set) => ({
      enabled: false,
      amountDb: -12,
      thresholdDb: -40,
      setEnabled: (enabled) => set({ enabled }),
      setAmountDb: (amountDb) => set({ amountDb }),
      setThresholdDb: (thresholdDb) => set({ thresholdDb }),
    }),
    { name: "cut.ducking.v1" },
  ),
);
