"use client";

import { useViewStore } from "@/stores/view-store";

// Rule-of-thirds grid plus title-safe (90%) and action-safe (93%) guides,
// drawn over the preview frame. Purely visual; toggled via the view store.
export function GuidesOverlay() {
  const show = useViewStore((s) => s.showGuides);
  if (!show) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* rule-of-thirds */}
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="0.2">
        <line x1="33.33" y1="0" x2="33.33" y2="100" />
        <line x1="66.66" y1="0" x2="66.66" y2="100" />
        <line x1="0" y1="33.33" x2="100" y2="33.33" />
        <line x1="0" y1="66.66" x2="100" y2="66.66" />
      </g>
      {/* action-safe ~93% */}
      <rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="rgba(255,210,0,0.45)" strokeWidth="0.25" />
      {/* title-safe ~90% */}
      <rect x="5" y="5" width="90" height="90" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.25" strokeDasharray="1.5 1" />
      {/* center cross */}
      <g stroke="rgba(255,255,255,0.3)" strokeWidth="0.2">
        <line x1="48" y1="50" x2="52" y2="50" />
        <line x1="50" y1="48" x2="50" y2="52" />
      </g>
    </svg>
  );
}
