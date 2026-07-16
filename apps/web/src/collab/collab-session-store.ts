"use client";

import { create } from "zustand";

type CollabConnectionStatus = "disconnected" | "connecting" | "connected";

interface CollabSessionState {
  hydrated: boolean;
  room: string | null;
  status: CollabConnectionStatus;
  setHydrated: (hydrated: boolean) => void;
  setConnection: (room: string | null, status: CollabConnectionStatus) => void;
  setStatus: (status: CollabConnectionStatus) => void;
}

// UI-facing lifecycle state kept outside the Y.Doc. In particular, changing
// projects disposes the old provider and clears `room`, so the collaboration
// button cannot remain visually connected to a room that no longer exists.
export const useCollabSessionStore = create<CollabSessionState>((set) => ({
  hydrated: false,
  room: null,
  status: "disconnected",
  setHydrated: (hydrated) => set({ hydrated }),
  setConnection: (room, status) => set({ room, status }),
  setStatus: (status) => set({ status }),
}));
