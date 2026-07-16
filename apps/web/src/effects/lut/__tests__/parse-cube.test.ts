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
    expect(lut.dimension).toBe(3);
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

  it("parses a 1D RGB curve LUT", () => {
    const lut = parseCube(`
      LUT_1D_SIZE 3
      DOMAIN_MIN -1.0 -1.0 -1.0
      DOMAIN_MAX 1.0 1.0 1.0
      0.0 0.0 0.0
      0.4 0.5 0.6
      1.0 1.0 1.0
    `);

    expect(lut.dimension).toBe(1);
    expect(lut.size).toBe(3);
    expect([...lut.data]).toEqual([
      0,
      0,
      0,
      expect.closeTo(0.4),
      0.5,
      expect.closeTo(0.6),
      1,
      1,
      1,
    ]);
    expect(lut.domainMin).toEqual([-1, -1, -1]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
  });

  it("rejects conflicting dimensions and invalid domains", () => {
    expect(() => parseCube("LUT_1D_SIZE 2\nLUT_3D_SIZE 2")).toThrow(/exactly one/);
    expect(() =>
      parseCube("LUT_1D_SIZE 2\nDOMAIN_MIN 1 0 0\nDOMAIN_MAX 0 1 1\n0 0 0\n1 1 1"),
    ).toThrow(/domain/);
  });
});
