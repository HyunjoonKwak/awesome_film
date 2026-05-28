"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredLut {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly raw: string;        // original .cube text, so we can round-trip
}

interface LutState {
  luts: readonly StoredLut[];
  addLut: (lut: StoredLut) => void;
  removeLut: (id: string) => void;
  getLut: (id: string) => StoredLut | undefined;
}

export const useLutStore = create<LutState>()(
  persist(
    (set, get) => ({
      luts: [],
      addLut: (lut) =>
        set((s) => ({ luts: [...s.luts.filter((x) => x.id !== lut.id), lut] })),
      removeLut: (id) => set((s) => ({ luts: s.luts.filter((l) => l.id !== id) })),
      getLut: (id) => get().luts.find((l) => l.id === id),
    }),
    { name: "cut.luts.v1" },
  ),
);
