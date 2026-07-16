import { describe, expect, it, vi } from "vitest";
import { BoundedResourceCache } from "../bounded-resource-cache";

describe("BoundedResourceCache", () => {
  it("evicts the least recently used entry at its hard limit", () => {
    const dispose = vi.fn();
    const cache = new BoundedResourceCache<string, object>(2, dispose);
    const a = {};
    const b = {};
    const c = {};
    cache.set("a", a);
    cache.set("b", b);
    expect(cache.get("a")).toBe(a);

    cache.set("c", c);

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(a);
    expect(cache.get("c")).toBe(c);
    expect(dispose).toHaveBeenCalledWith(b, "b");
  });

  it("disposes replaced, removed, and cleared resources exactly once", () => {
    const disposed: string[] = [];
    const cache = new BoundedResourceCache<string, string>(3, (value) => disposed.push(value));
    cache.set("a", "old-a");
    cache.set("a", "new-a");
    cache.set("b", "b");
    cache.retain(new Set(["a"]));
    cache.clear();

    expect(disposed).toEqual(["old-a", "b", "new-a"]);
    expect(cache.size).toBe(0);
  });

  it("rejects invalid limits", () => {
    expect(() => new BoundedResourceCache(0, () => {})).toThrow("positive integer");
  });
});
