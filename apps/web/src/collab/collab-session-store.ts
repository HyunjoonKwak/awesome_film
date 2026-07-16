"use client";

import { create } from "zustand";

interface CollabSessionState {
  hydrated: boolean;
  room: string | null;
  setHydrated: (hydrated: boolean) => void;
  setRoom: (room: string | null) => void;
}

// UI-facing lifecycle state kept outside the Y.Doc. In particular, changing
// projects disposes the old provider and clears `room`, so the collaboration
// button cannot remain visually connected to a room that no longer exists.
export const useCollabSessionStore = create<CollabSessionState>((set) => ({
  hydrated: false,
  room: null,
  setHydrated: (hydrated) => set({ hydrated }),
  setRoom: (room) => set({ room }),
}));
