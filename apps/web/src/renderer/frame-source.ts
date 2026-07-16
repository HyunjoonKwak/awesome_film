import type { MediaAsset } from "@cut/core";
import { getMediaUrl } from "@/persistence/opfs";
import { useProxyStore } from "@/media/proxy-store";

type Source = HTMLVideoElement | HTMLImageElement;

// Caches HTMLImageElement and HTMLVideoElement instances per asset so we
// avoid the cost of reloading the media on every frame. In phase 3.1 this
// gets swapped for a WebCodecs VideoDecoder + a VideoFrame LRU cache to
// achieve true frame-accurate scrubbing without the <video> seek dance.
export class FrameSourcePool {
  private readonly cache = new Map<string, Source>();
  private readonly pending = new Map<string, Promise<Source | null>>();
  private readonly retryAt = new Map<string, number>();

  async get(asset: MediaAsset): Promise<Source | null> {
    const cached = this.cache.get(asset.id);
    if (cached) return cached;
    if ((this.retryAt.get(asset.id) ?? 0) > Date.now()) return null;
    const inflight = this.pending.get(asset.id);
    if (inflight) return inflight;
    const promise = this.load(asset);
    this.pending.set(asset.id, promise);
    const loaded = await promise;
    this.pending.delete(asset.id);
    if (loaded) {
      this.cache.set(asset.id, loaded);
      this.retryAt.delete(asset.id);
    } else {
      // Remote collaboration metadata can arrive before its binary file.
      // Retry with a small backoff instead of permanently caching the miss or
      // probing OPFS on every animation frame.
      this.retryAt.set(asset.id, Date.now() + 1000);
    }
    return loaded;
  }

  private async load(asset: MediaAsset): Promise<Source | null> {
    // Use the low-res proxy for preview/scrub when enabled and available.
    const useProxy = useProxyStore.getState().useProxy;
    const proxyUrl = useProxy && asset.proxyPath ? await getMediaUrl(asset.proxyPath) : null;
    const url = proxyUrl ?? (await getMediaUrl(asset.opfsPath));
    if (!url) return null;
    if (asset.kind === "image") {
      return await new Promise<Source | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }
    if (asset.kind === "video") {
      return await new Promise<Source | null>((resolve) => {
        const v = document.createElement("video");
        v.crossOrigin = "anonymous";
        v.preload = "auto";
        v.muted = true;
        v.playsInline = true;
        v.onloadeddata = () => resolve(v);
        v.onerror = () => resolve(null);
        v.src = url;
      });
    }
    return null; // audio handled elsewhere
  }

  dispose() {
    this.cache.clear();
    this.pending.clear();
    this.retryAt.clear();
  }
}
