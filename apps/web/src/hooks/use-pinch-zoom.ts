"use client";

import { useEffect, useRef, type RefObject } from "react";

interface PinchOpts {
  onZoom: (factor: number) => void;
  onPan?: (deltaXPx: number) => void;
}

// Two-finger pinch zoom + single-finger pan on touch devices. Designed for
// the timeline scroller — wires directly to the surface ref.
export const usePinchZoom = (
  ref: RefObject<HTMLElement | null>,
  { onZoom, onPan }: PinchOpts,
) => {
  const state = useRef<{
    activeIds: number[];
    lastDistance: number;
    lastX: number;
  }>({ activeIds: [], lastDistance: 0, lastX: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const touches = new Map<number, PointerEvent>();

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, e);
      state.current.activeIds = [...touches.keys()];
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        state.current.lastDistance = Math.hypot(a!.clientX - b!.clientX, a!.clientY - b!.clientY);
      } else if (touches.size === 1) {
        state.current.lastX = e.clientX;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, e);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const dist = Math.hypot(a!.clientX - b!.clientX, a!.clientY - b!.clientY);
        if (state.current.lastDistance > 0) {
          const factor = dist / state.current.lastDistance;
          if (Math.abs(factor - 1) > 0.01) onZoom(factor);
        }
        state.current.lastDistance = dist;
        e.preventDefault();
      } else if (touches.size === 1 && onPan) {
        const dx = e.clientX - state.current.lastX;
        state.current.lastX = e.clientX;
        onPan(dx);
      }
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      state.current.activeIds = [...touches.keys()];
      state.current.lastDistance = 0;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [ref, onZoom, onPan]);
};
