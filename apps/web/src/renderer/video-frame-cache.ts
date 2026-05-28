// LRU cache of VideoFrames keyed by `${assetId}:${timestampUs}`. Decoders
// don't always emit frames in display order, so callers stash whatever the
// decoder hands them and pull the nearest neighbour at lookup time.

export interface CachedFrame {
  readonly assetId: string;
  readonly timestampUs: number;
  readonly frame: VideoFrame;
}

const MAX_FRAMES = 24;

export class VideoFrameCache {
  private readonly order: string[] = [];
  private readonly map = new Map<string, CachedFrame>();

  private keyFor(assetId: string, ts: number) {
    return `${assetId}:${ts}`;
  }

  store(assetId: string, frame: VideoFrame): void {
    const key = this.keyFor(assetId, frame.timestamp);
    if (this.map.has(key)) {
      // duplicate timestamp — replace, free old
      this.map.get(key)!.frame.close();
      this.map.delete(key);
      const i = this.order.indexOf(key);
      if (i >= 0) this.order.splice(i, 1);
    }
    this.map.set(key, { assetId, timestampUs: frame.timestamp, frame });
    this.order.push(key);
    while (this.order.length > MAX_FRAMES) {
      const evict = this.order.shift();
      if (!evict) break;
      const f = this.map.get(evict);
      if (f) {
        f.frame.close();
        this.map.delete(evict);
      }
    }
  }

  nearest(assetId: string, targetUs: number): CachedFrame | null {
    let best: CachedFrame | null = null;
    let bestDelta = Infinity;
    for (const f of this.map.values()) {
      if (f.assetId !== assetId) continue;
      const d = Math.abs(f.timestampUs - targetUs);
      if (d < bestDelta) {
        bestDelta = d;
        best = f;
      }
    }
    return best;
  }

  forget(assetId: string): void {
    for (const key of [...this.order]) {
      const f = this.map.get(key);
      if (f && f.assetId === assetId) {
        f.frame.close();
        this.map.delete(key);
        this.order.splice(this.order.indexOf(key), 1);
      }
    }
  }

  clear(): void {
    for (const f of this.map.values()) f.frame.close();
    this.map.clear();
    this.order.length = 0;
  }
}
