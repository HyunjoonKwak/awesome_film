"use client";

import { create } from "zustand";

// Bulk-import progress + cancellation. The import loop advances this store
// per file and checks `cancelRequested` between files; the media bin renders
// a progress bar with a stop button while `active`.

interface ImportProgressState {
  active: boolean;
  total: number;
  done: number;
  failed: number;
  currentName: string;
  cancelRequested: boolean;

  start: (total: number) => void;
  beginFile: (name: string) => void;
  fileDone: () => void;
  fileFailed: () => void;
  requestCancel: () => void;
  finish: () => void;
}

export const useImportProgressStore = create<ImportProgressState>((set) => ({
  active: false,
  total: 0,
  done: 0,
  failed: 0,
  currentName: "",
  cancelRequested: false,

  start: (total) =>
    set({ active: true, total, done: 0, failed: 0, currentName: "", cancelRequested: false }),
  beginFile: (currentName) => set({ currentName }),
  fileDone: () => set((s) => ({ done: s.done + 1 })),
  fileFailed: () => set((s) => ({ failed: s.failed + 1 })),
  requestCancel: () => set({ cancelRequested: true }),
  finish: () => set({ active: false, currentName: "" }),
}));
