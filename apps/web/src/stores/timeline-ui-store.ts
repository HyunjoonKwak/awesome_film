import { create } from "zustand";

// Transient timeline interaction state — never persisted, never in undo
// history. `snapMs` drives the vertical snap guide while dragging clips;
// `dragAssetId` is the media-bin asset currently being dragged so tracks
// can render a drop preview (dataTransfer payloads are unreadable during
// dragover, hence the store).
interface TimelineUiState {
  readonly snapMs: number | null;
  readonly dragAssetId: string | null;
  setSnapMs: (ms: number | null) => void;
  setDragAssetId: (id: string | null) => void;
}

export const useTimelineUiStore = create<TimelineUiState>((set) => ({
  snapMs: null,
  dragAssetId: null,
  setSnapMs: (snapMs) => set({ snapMs }),
  setDragAssetId: (dragAssetId) => set({ dragAssetId }),
}));
