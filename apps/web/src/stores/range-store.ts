import { create } from "zustand";

// In/out work-area points (ms) that limit export to a sub-range of the
// timeline. Transient (not persisted) — cleared per session.
interface RangeState {
  readonly inMs: number | null;
  readonly outMs: number | null;
  setIn: (ms: number | null) => void;
  setOut: (ms: number | null) => void;
  clear: () => void;
}

export const useRangeStore = create<RangeState>((set) => ({
  inMs: null,
  outMs: null,
  // Keep in < out when both are set; setting a crossing point pushes the other.
  setIn: (ms) =>
    set((s) => ({ inMs: ms, outMs: ms !== null && s.outMs !== null && ms >= s.outMs ? null : s.outMs })),
  setOut: (ms) =>
    set((s) => ({ outMs: ms, inMs: ms !== null && s.inMs !== null && ms <= s.inMs ? null : s.inMs })),
  clear: () => set({ inMs: null, outMs: null }),
}));
