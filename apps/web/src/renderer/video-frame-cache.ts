// LRU cache of VideoFrames keyed by `${assetId}:${timestampUs}`. Decoders
// don't always emit frames in display order, so callers stash whatever the
// decoder hands them and pull the nearest neighbour at lookup time.

export interface CachedFrame {
  readonly assetId: string;
  readonly timestampUs: number;
  readonly frame: VideoFrame;
}

// Frames retained PER ASSET. The decoder pulls a ~770ms window around the
// playhead; at 60fps that's ~46 frames, so a smaller cap would evict the
// just-decoded playhead frame before it's used and churn back to the <video>
// fallback. Per-asset (not one global pool) so two visible clips —
// multi-track / picture-in-picture — don't evict each other. Total memory
// scales with concurrently-decoded assets, which stays small because only
// visible clips decode.
export const MAX_FRAMES_PER_ASSET = 48;

export class VideoFrameCache {
  private readonly map = new Map<string, CachedFrame>();
  private readonly orderByAsset = new Map<string, string[]>();

  private keyFor(assetId: string, ts: number) {
    return `${assetId}:${ts}`;
  }

  private orderFor(assetId: string): string[] {
    let order = this.orderByAsset.get(assetId);
    if (!order) {
      order = [];
      this.orderByAsset.set(assetId, order);
    }
    return order;
  }

  store(assetId: string, frame: VideoFrame): void {
    const key = this.keyFor(assetId, frame.timestamp);
    const order = this.orderFor(assetId);
    if (this.map.has(key)) {
      // duplicate timestamp — replace, free old
      this.map.get(key)?.frame.close();
      this.map.delete(key);
      const i = order.indexOf(key);
      if (i >= 0) order.splice(i, 1);
    }
    this.map.set(key, { assetId, timestampUs: frame.timestamp, frame });
    order.push(key);
    while (order.length > MAX_FRAMES_PER_ASSET) {
      const evict = order.shift();
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
  // showing a frame from the wrong moment. Default tolerance is unbounded to
  // preserve plain nearest-neighbour lookups.
  nearest(
    assetId: string,
    targetUs: number,
    toleranceUs = Number.POSITIVE_INFINITY,
  ): CachedFrame | null {
    const order = this.orderByAsset.get(assetId);
    if (!order) return null;
    let best: CachedFrame | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const key of order) {
      const f = this.map.get(key);
      if (!f) continue;
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
    const index = order.indexOf(key);
    if (index >= 0) {
      order.splice(index, 1);
      order.push(key);
    }
    return best;
  }

  forget(assetId: string): void {
    const order = this.orderByAsset.get(assetId);
    if (!order) return;
    for (const key of order) {
      this.map.get(key)?.frame.close();
      this.map.delete(key);
    }
    this.orderByAsset.delete(assetId);
  }

  clear(): void {
    for (const f of this.map.values()) f.frame.close();
    this.map.clear();
    this.orderByAsset.clear();
  }
}
