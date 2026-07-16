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
      this.map.get(key)?.frame.close();
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

  // Closest cached frame within `toleranceUs` of the target time. Beyond that
  // we return null so the caller falls back to a real <video> seek instead of
  // showing a frame from the wrong moment — the 24-slot cache is global, so
  // the "nearest" frame for a just-requested time can actually be the end of
  // a long clip whose start was already evicted. Default tolerance is
  // unbounded to preserve plain nearest-neighbour lookups.
  nearest(
    assetId: string,
    targetUs: number,
    toleranceUs = Number.POSITIVE_INFINITY,
  ): CachedFrame | null {
    let best: CachedFrame | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const f of this.map.values()) {
      if (f.assetId !== assetId) continue;
      const d = Math.abs(f.timestampUs - targetUs);
      if (d < bestDelta) {
        bestDelta = d;
        best = f;
      }
    }
    if (!best || bestDelta > toleranceUs) return null;
    // Touch on successful lookup so eviction follows actual LRU semantics,
    // not merely insertion order.
    const key = this.keyFor(best.assetId, best.timestampUs);
    const index = this.order.indexOf(key);
    if (index >= 0) {
      this.order.splice(index, 1);
      this.order.push(key);
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
