"use client";

import { useProjectStore, selectPlayhead, selectZoom } from "@/stores/project-store";

export function Playhead({ containerWidth }: { containerWidth: number }) {
  const playhead = useProjectStore(selectPlayhead);
  const zoom = useProjectStore(selectZoom);
  const x = 96 + playhead * zoom; // 96px = track header width

  if (x > containerWidth) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 z-20 h-full w-px bg-accent"
      style={{ left: x }}
      aria-hidden
    >
      <div className="absolute -left-1.5 top-0 size-3 rotate-45 bg-accent" />
    </div>
  );
}
