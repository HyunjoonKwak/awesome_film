import { create } from "zustand";
import { persist } from "zustand/middleware";

// Editor view preferences that are independent of the project document:
// overlay guides, etc. Persisted so they survive reloads.
interface ViewState {
  readonly showGuides: boolean;
  readonly showShortcuts: boolean;
  toggleGuides: () => void;
  setShowGuides: (v: boolean) => void;
  toggleShortcuts: () => void;
  setShowShortcuts: (v: boolean) => void;
}

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      showGuides: false,
      showShortcuts: false,
      toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
      setShowGuides: (v) => set({ showGuides: v }),
      toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
      setShowShortcuts: (v) => set({ showShortcuts: v }),
    }),
    // Only persist guides; the shortcuts overlay should always start closed.
    { name: "cut-editor:view", partialize: (s) => ({ showGuides: s.showGuides }) },
  ),
);
