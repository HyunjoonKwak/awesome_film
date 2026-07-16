// Small deterministic LRU for resources that need explicit destruction
// (WebGL textures, media elements, decoder handles). Reading an entry marks it
// as recently used; insertion enforces the configured hard cap.
export class BoundedResourceCache<K, V> {
  private readonly entries = new Map<K, { value: V; usedAt: number }>();
  private clock = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly disposeValue: (value: V, key: K) => void,
  ) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("BoundedResourceCache maxEntries must be a positive integer");
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    entry.usedAt = ++this.clock;
    return entry.value;
  }

  set(key: K, value: V): void {
    const previous = this.entries.get(key);
    if (previous && previous.value !== value) this.disposeValue(previous.value, key);
    this.entries.set(key, { value, usedAt: ++this.clock });
    this.pruneToLimit();
  }

  delete(key: K): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.disposeValue(entry.value, key);
    return true;
  }

  retain(keys: ReadonlySet<K>): void {
    for (const key of this.entries.keys()) {
      if (!keys.has(key)) this.delete(key);
    }
  }

  clear(): void {
    for (const [key, entry] of this.entries) this.disposeValue(entry.value, key);
    this.entries.clear();
  }

  private pruneToLimit(): void {
    while (this.entries.size > this.maxEntries) {
      let oldestKey: K | undefined;
      let found = false;
      let oldestUse = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.entries) {
        if (entry.usedAt < oldestUse) {
          oldestKey = key;
          found = true;
          oldestUse = entry.usedAt;
        }
      }
      if (!found) return;
      this.delete(oldestKey as K);
    }
  }
}
