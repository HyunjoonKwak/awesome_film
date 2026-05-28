"use client";

import { useRef } from "react";
import { useTrackRegionStore, type NormalizedRegion } from "./track-region-store";

// Drag-to-draw a normalized tracking region over the preview. Shown only
// while the tracking-region selection mode is active. Coordinates are 0..1
// relative to the preview frame box.
export function RegionOverlay() {
  const selecting = useTrackRegionStore((s) => s.selecting);
  const region = useTrackRegionStore((s) => s.region);
  const setRegion = useTrackRegionStore((s) => s.setRegion);
  const setSelecting = useTrackRegionStore((s) => s.setSelecting);
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x0: number; y0: number } | null>(null);

  if (!selecting && !region) return null;

  const toNorm = (e: React.PointerEvent): { x: number; y: number } => {
    const el = ref.current!;
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!selecting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toNorm(e);
    dragRef.current = { x0: p.x, y0: p.y };
    setRegion({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const p = toNorm(e);
    const { x0, y0 } = dragRef.current;
    const next: NormalizedRegion = {
      x: Math.min(x0, p.x),
      y: Math.min(y0, p.y),
      w: Math.abs(p.x - x0),
      h: Math.abs(p.y - y0),
    };
    setRegion(next);
  };
  const onPointerUp = () => {
    dragRef.current = null;
    setSelecting(false);
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 z-20"
      style={{ cursor: selecting ? "crosshair" : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {region && region.w > 0 && region.h > 0 && (
        <div
          className="absolute border-2 border-accent bg-accent/10"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.w * 100}%`,
            height: `${region.h * 100}%`,
          }}
        />
      )}
    </div>
  );
}
