"use client";

import { useAwarenessStore } from "@/collab/awareness-store";
import { useProjectStore, selectZoom } from "@/stores/project-store";

const TRACK_HEADER_W = 96;

// Renders remote collaborators' playheads as colored vertical lines with a
// name flag. Driven by Yjs awareness via the awareness store.
export function PeerCursors() {
  const peers = useAwarenessStore((s) => s.peers);
  const zoom = useProjectStore(selectZoom);

  const list = Array.from(peers.values()).filter((p) => p.playheadMs !== null);
  if (list.length === 0) return null;

  return (
    <>
      {list.map((p) => (
        <div
          key={p.id}
          className="pointer-events-none absolute top-0 z-30 h-full"
          style={{ left: TRACK_HEADER_W + (p.playheadMs ?? 0) * zoom }}
        >
          <div className="h-full w-px" style={{ backgroundColor: p.color }} />
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-medium text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name}
          </span>
        </div>
      ))}
    </>
  );
}
