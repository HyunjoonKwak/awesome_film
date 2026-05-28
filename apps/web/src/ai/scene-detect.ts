import type { SceneCut } from "./types";

// Lightweight scene cut detector. Walks the video at a coarse FPS, captures
// frames into a small canvas, computes a normalised RGB histogram, and emits
// a cut when consecutive frames differ by more than `threshold` (χ²-like).

const FRAME_FPS = 2;          // sample at 2 fps — enough for cut detection
const THUMB_SIZE = 64;
const BUCKETS = 8;            // per channel

const histogram = (data: Uint8ClampedArray): Float32Array => {
  const h = new Float32Array(BUCKETS * 3);
  const step = 256 / BUCKETS;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    h[Math.min(BUCKETS - 1, Math.floor(data[i]! / step))]!++;
    h[BUCKETS + Math.min(BUCKETS - 1, Math.floor(data[i + 1]! / step))]!++;
    h[2 * BUCKETS + Math.min(BUCKETS - 1, Math.floor(data[i + 2]! / step))]!++;
    n++;
  }
  // Normalise to a distribution.
  for (let i = 0; i < h.length; i++) h[i]! /= Math.max(1, n);
  return h;
};

const chiSquared = (a: Float32Array, b: Float32Array): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    const denom = ai + bi;
    if (denom > 0) s += ((ai - bi) ** 2) / denom;
  }
  return s;
};

export const detectScenesFromBlob = async (
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<readonly SceneCut[]> => {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video load failed"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas2D unavailable");

    const duration = video.duration;
    const samples = Math.max(2, Math.floor(duration * FRAME_FPS));
    const cuts: SceneCut[] = [];
    let prev: Float32Array | null = null;
    const threshold = 0.45;

    for (let i = 0; i < samples; i++) {
      const t = (i / samples) * duration;
      video.currentTime = t;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
      });
      ctx.drawImage(video, 0, 0, THUMB_SIZE, THUMB_SIZE);
      const data = ctx.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE).data;
      const h = histogram(data);
      if (prev) {
        const diff = chiSquared(prev, h);
        if (diff > threshold) {
          cuts.push({ atMs: Math.round(t * 1000), score: diff });
        }
      }
      prev = h;
      if (i % 4 === 0) onProgress?.(i / samples);
    }
    onProgress?.(1);
    // Merge cuts that are within 800ms of each other (Whisper-style hysteresis).
    return cuts.filter((c, i, arr) => i === 0 || c.atMs - arr[i - 1]!.atMs > 800);
  } finally {
    URL.revokeObjectURL(url);
  }
};
