import { describe, expect, it } from "vitest";
import { isMediaKeyLeased, leaseMediaKey } from "../media-gc";

describe("media GC leases", () => {
  it("keeps a key leased until every holder releases it", () => {
    const releaseA = leaseMediaKey("importing.mov");
    const releaseB = leaseMediaKey("importing.mov");
    expect(isMediaKeyLeased("importing.mov")).toBe(true);

    releaseA();
    expect(isMediaKeyLeased("importing.mov")).toBe(true);
    releaseB();
    expect(isMediaKeyLeased("importing.mov")).toBe(false);
  });

  it("makes release idempotent", () => {
    const release = leaseMediaKey("proxy.mp4");
    release();
    release();
    expect(isMediaKeyLeased("proxy.mp4")).toBe(false);
  });
});
