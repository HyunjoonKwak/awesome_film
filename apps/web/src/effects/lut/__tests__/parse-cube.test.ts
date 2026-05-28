import { describe, expect, it } from "vitest";
import { parseCube } from "../parse-cube";

const TINY_LUT = `
# 2x2x2 identity LUT for tests
TITLE "Identity"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;

describe("parseCube", () => {
  it("parses a 2x2x2 LUT", () => {
    const lut = parseCube(TINY_LUT);
    expect(lut.size).toBe(2);
    expect(lut.data.length).toBe(2 * 2 * 2 * 3);
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
    expect(lut.data[0]).toBe(0);
    expect(lut.data[lut.data.length - 1]).toBe(1);
  });

  it("rejects truncated files", () => {
    expect(() => parseCube("LUT_3D_SIZE 2\n0 0 0")).toThrow();
  });
});
