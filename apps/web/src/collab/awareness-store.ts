"use client";

import { create } from "zustand";

export interface PeerCursor {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly playheadMs: number | null;
  readonly selectedClipIds: readonly string[];
}

interface AwarenessState {
  selfId: string;
  selfName: string;
  selfColor: string;
  peers: ReadonlyMap<string, PeerCursor>;
  setSelf: (patch: Partial<Pick<AwarenessState, "selfName" | "selfColor">>) => void;
  setPeers: (peers: ReadonlyMap<string, PeerCursor>) => void;
}

const palette = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#06b6d4", "#a855f7"];

const randomFromPalette = () =>
  palette[Math.floor(Math.random() * palette.length)] ?? "#6366f1";

export const useAwarenessStore = create<AwarenessState>((set) => ({
  selfId:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  selfName: "You",
  selfColor: randomFromPalette(),
  peers: new Map(),
  setSelf: (patch) => set((s) => ({ ...s, ...patch })),
  setPeers: (peers) => set({ peers }),
}));
