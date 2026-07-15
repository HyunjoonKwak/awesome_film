// WebCodecs frame provider backed by mp4box.js demuxing. Tries to decode the
// asset once on first access, then serves the closest cached VideoFrame for
// any requested timestamp. Callers fall back to the <video> path when this
// returns null (unsupported codec, container, or browser).

import { VideoFrameCache } from "./video-frame-cache";
import { decodeMp4ToCache, type DecoderHandle } from "./mp4-decoder";

export const isWebCodecsAvailable = (): boolean =>
  typeof window !== "undefined" && "VideoDecoder" in window;

// A cached frame is only trusted if it's within this window of the requested
// time. Beyond it we return null so the compositor seeks a real <video>
// instead of showing a far-off cached frame (the cache is a small global LRU).
const FRAME_TOLERANCE_US = 100_000; // 100ms

export interface FrameProvider {
  framesFor(assetId: string, atMs: number): VideoFrame | null;
  prepare(assetId: string, blob: Blob): Promise<boolean>;
  forget(assetId: string): void;
  dispose(): void;
}

class CachingFrameProvider implements FrameProvider {
  private readonly cache = new VideoFrameCache();
  private readonly handles = new Map<string, DecoderHandle>();
  private readonly pending = new Map<string, Promise<boolean>>();

  framesFor(assetId: string, atMs: number): VideoFrame | null {
    const f = this.cache.nearest(assetId, Math.round(atMs * 1000), FRAME_TOLERANCE_US);
    return f ? f.frame : null;
  }

  async prepare(assetId: string, blob: Blob): Promise<boolean> {
    if (!isWebCodecsAvailable()) return false;
    if (this.handles.has(assetId)) return true;
    const inflight = this.pending.get(assetId);
    if (inflight) return inflight;

    const job = (async (): Promise<boolean> => {
      try {
        const handle = await decodeMp4ToCache(blob, assetId, this.cache);
        if (!handle) return false;
        this.handles.set(assetId, handle);
        return true;
      } catch {
        return false;
      } finally {
        this.pending.delete(assetId);
      }
    })();
    this.pending.set(assetId, job);
    return job;
  }

  forget(assetId: string) {
    this.cache.forget(assetId);
    this.handles.get(assetId)?.close();
    this.handles.delete(assetId);
  }

  dispose() {
    for (const h of this.handles.values()) h.close();
    this.handles.clear();
    this.cache.clear();
  }
}

let singleton: FrameProvider | null = null;

export const getFrameProvider = (): FrameProvider => {
  if (!singleton) singleton = new CachingFrameProvider();
  return singleton;
};
