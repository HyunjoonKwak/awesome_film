// Shared timeline layout constants. Single source of truth — the track
// header width is used for pointer→time math, the playhead offset and the
// sticky header sizing.
export const TRACK_HEADER_W = 96;

// Zoom limits in px-per-ms (0.005 = 5px/s, 1 = 1000px/s).
const PX_PER_MS_MIN = 0.005;
const PX_PER_MS_MAX = 1;

export const clampZoom = (z: number): number => Math.min(PX_PER_MS_MAX, Math.max(PX_PER_MS_MIN, z));
