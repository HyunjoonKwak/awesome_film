// Lightweight motion tracker. Given a video blob, a starting rectangle
// (normalized 0..1), and a time range, it samples frames and follows the
// template patch using a local normalized cross-correlation (NCC) search.
// Emits a list of normalized center points per timestamp; the caller turns
// those into transform keyframes.

export interface TrackPoint {
  readonly atMs: number;
  readonly x: number; // normalized center [0..1]
  readonly y: number;
}

export interface TrackRegion {
  readonly x: number; // normalized top-left
  readonly y: number;
  readonly w: number; // normalized size
  readonly h: number;
}

interface Gray {
  data: Float32Array;
  width: number;
  height: number;
}

const SAMPLE_W = 320; // downscale width for tracking speed

const toGray = (canvas: HTMLCanvasElement): Gray => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height).data;
  const data = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    data[i] = (img[i * 4]! * 0.299 + img[i * 4 + 1]! * 0.587 + img[i * 4 + 2]! * 0.114) / 255;
  }
  return { data, width, height };
};

const patchAt = (g: Gray, cx: number, cy: number, pw: number, ph: number): Float32Array | null => {
  const x0 = Math.round(cx - pw / 2);
  const y0 = Math.round(cy - ph / 2);
  if (x0 < 0 || y0 < 0 || x0 + pw > g.width || y0 + ph > g.height) return null;
  const out = new Float32Array(pw * ph);
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      out[y * pw + x] = g.data[(y0 + y) * g.width + (x0 + x)]!;
    }
  }
  return out;
};

const ncc = (a: Float32Array, b: Float32Array): number => {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    ma += a[i]!;
    mb += b[i]!;
  }
  ma /= a.length;
  mb /= b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]! - ma;
    const bv = b[i]! - mb;
    num += av * bv;
    da += av * av;
    db += bv * bv;
  }
  const denom = Math.sqrt(da * db);
  return denom < 1e-6 ? 0 : num / denom;
};

export const trackRegion = async (
  blob: Blob,
  region: TrackRegion,
  startMs: number,
  endMs: number,
  fps = 5,
  onProgress?: (pct: number) => void,
): Promise<readonly TrackPoint[]> => {
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

    const aspect = video.videoHeight / video.videoWidth || 0.5625;
    const w = SAMPLE_W;
    const h = Math.round(SAMPLE_W * aspect);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    const seek = (sec: number) =>
      new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = sec;
      });

    const pw = Math.max(8, Math.round(region.w * w));
    const ph = Math.max(8, Math.round(region.h * h));
    let cx = (region.x + region.w / 2) * w;
    let cy = (region.y + region.h / 2) * h;

    // Seed template from the first frame.
    await seek(Math.max(0, startMs / 1000));
    ctx.drawImage(video, 0, 0, w, h);
    let template = patchAt(toGray(canvas), cx, cy, pw, ph);
    if (!template) return [];

    const points: TrackPoint[] = [{ atMs: startMs, x: cx / w, y: cy / h }];
    const step = 1000 / fps;
    const searchR = Math.max(8, Math.round(pw * 0.6));

    for (let tMs = startMs + step; tMs <= endMs; tMs += step) {
      await seek(tMs / 1000);
      ctx.drawImage(video, 0, 0, w, h);
      const g = toGray(canvas);

      let best = -2;
      let bx = cx;
      let by = cy;
      for (let dy = -searchR; dy <= searchR; dy += 2) {
        for (let dx = -searchR; dx <= searchR; dx += 2) {
          const cand = patchAt(g, cx + dx, cy + dy, pw, ph);
          if (!cand) continue;
          const score = ncc(template!, cand);
          if (score > best) {
            best = score;
            bx = cx + dx;
            by = cy + dy;
          }
        }
      }
      cx = bx;
      cy = by;
      points.push({ atMs: tMs, x: cx / w, y: cy / h });

      // Slowly adapt the template to handle gradual appearance changes.
      const refreshed = patchAt(g, cx, cy, pw, ph);
      if (refreshed && best > 0.5) template = refreshed;

      onProgress?.((tMs - startMs) / Math.max(1, endMs - startMs));
    }
    onProgress?.(1);
    return points;
  } finally {
    URL.revokeObjectURL(url);
  }
};
