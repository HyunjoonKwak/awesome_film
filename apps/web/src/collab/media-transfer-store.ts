"use client";

import { create } from "zustand";

interface MediaTransferProgress {
  readonly assetId: string;
  readonly name: string;
  readonly receivedBytes: number;
  readonly totalBytes: number;
}

interface MediaTransferState {
  progress: MediaTransferProgress | null;
  error: string | null;
  setProgress: (progress: MediaTransferProgress | null) => void;
  setError: (error: string | null) => void;
}

export const useMediaTransferStore = create<MediaTransferState>((set) => ({
  progress: null,
  error: null,
  setProgress: (progress) => set({ progress, error: null }),
  setError: (error) => set({ error, progress: null }),
}));
