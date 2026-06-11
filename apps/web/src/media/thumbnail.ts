// Generate a small thumbnail data URL for the media bin.
// For video, samples a frame near the start; for image, downscales.

const TARGET = 240;

const drawToDataUrl = (
  source: HTMLVideoElement | HTMLImageElement,
  w: number,
  h: number,
): string => {
  const ratio = w / h;
  const tw = Math.min(TARGET, w);
  const th = Math.round(tw / ratio);
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, tw, th);
  return canvas.toDataURL("image/webp", 0.7);
};

export const makeImageThumb = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const data = drawToDataUrl(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("thumb-image"));
    };
    img.src = url;
  });

// Frame height for filmstrip tiles; width derives from the video aspect ratio.
const STRIP_H = 48;

// Builds a wide filmstrip image sampling `frames` evenly-spaced frames across
// the whole source. Returns the data URL and the actual frame count drawn.
export const makeVideoFilmstrip = (
  file: File,
  frames = 10,
): Promise<{ dataUrl: string; frames: number } | null> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const duration = video.duration;
      if (!Number.isFinite(duration) || duration <= 0 || !video.videoWidth) {
        cleanup();
        resolve(null);
        return;
      }
      const ratio = video.videoWidth / video.videoHeight;
      const tileW = Math.max(1, Math.round(STRIP_H * ratio));
      const n = Math.max(2, Math.min(frames, 30));
      const canvas = document.createElement("canvas");
      canvas.width = tileW * n;
      canvas.height = STRIP_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(null);
        return;
      }

      let i = 0;
      const seekNext = () => {
        // Sample at the center of each segment to avoid black intro frames.
        const tt = ((i + 0.5) / n) * duration;
        video.currentTime = Math.min(tt, Math.max(0, duration - 0.05));
      };
      video.onseeked = () => {
        ctx.drawImage(video, i * tileW, 0, tileW, STRIP_H);
        i++;
        if (i >= n) {
          cleanup();
          resolve({ dataUrl: canvas.toDataURL("image/webp", 0.6), frames: n });
        } else {
          seekNext();
        }
      };
      seekNext();
    };
    video.onerror = () => {
      cleanup();
      resolve(null);
    };
    video.src = url;
  });

export const makeVideoThumb = (file: File, atSec = 0.1): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const seekTo = Math.min(atSec, Math.max(0, video.duration - 0.1));
      video.currentTime = seekTo;
    };
    video.onseeked = () => {
      try {
        const data = drawToDataUrl(video, video.videoWidth, video.videoHeight);
        cleanup();
        resolve(data);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("thumb-video"));
    };
    video.src = url;
  });
