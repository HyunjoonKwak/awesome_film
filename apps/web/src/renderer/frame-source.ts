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

  async get(asset: MediaAsset): Promise<Source | null> {
    const cached = this.cache.get(asset.id);
    if (cached) return cached;
    const inflight = this.pending.get(asset.id);
    if (inflight) return inflight;
    const promise = this.load(asset);
    this.pending.set(asset.id, promise);
    const loaded = await promise;
    this.pending.delete(asset.id);
    if (loaded) this.cache.set(asset.id, loaded);
    return loaded;
  }

  private async load(asset: MediaAsset): Promise<Source | null> {
    // Use the low-res proxy for preview/scrub when enabled and available.
    const useProxy = useProxyStore.getState().useProxy;
    const path = useProxy && asset.proxyPath ? asset.proxyPath : asset.opfsPath;
    const url = await getMediaUrl(path);
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
  }
}
