import { describe, expect, it } from "vitest";
import { frameDecodeWindow } from "../mp4-decoder";

describe("frameDecodeWindow", () => {
  it("keeps a bounded look-behind and look-ahead around the playhead", () => {
    expect(frameDecodeWindow(2_000_000)).toEqual({
      startUs: 1_880_000,
      endUs: 2_650_000,
    });
  });

  it("does not request negative media time near the beginning", () => {
    expect(frameDecodeWindow(50_000).startUs).toBe(0);
  });
});
