// Minimal Adobe .cube parser. We only handle the most common cases:
//   - 3D LUTs of size 8..64
//   - DOMAIN_MIN / DOMAIN_MAX defaulting to 0..1
// Header keys are case-insensitive; comments start with `#`.

export interface CubeLut {
  readonly size: number;       // grid side length
  readonly data: Float32Array; // size^3 * 3 RGB floats in row-major order (B slowest)
  readonly domainMin: readonly [number, number, number];
  readonly domainMax: readonly [number, number, number];
}

export const parseCube = (text: string): CubeLut => {
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.split("#")[0]!.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith("title")) continue;
    if (lower.startsWith("lut_3d_size")) {
      size = Number(line.split(/\s+/)[1]);
      continue;
    }
    if (lower.startsWith("lut_1d_size")) {
      throw new Error("1D LUTs are not supported yet");
    }
    if (lower.startsWith("domain_min")) {
      const [, r, g, b] = line.split(/\s+/);
      domainMin = [Number(r), Number(g), Number(b)];
      continue;
    }
    if (lower.startsWith("domain_max")) {
      const [, r, g, b] = line.split(/\s+/);
      domainMax = [Number(r), Number(g), Number(b)];
      continue;
    }
    const nums = line.split(/\s+/).map(Number);
    if (nums.length === 3 && nums.every((n) => Number.isFinite(n))) {
      values.push(nums[0]!, nums[1]!, nums[2]!);
    }
  }

  if (size === 0) throw new Error("LUT_3D_SIZE missing");
  if (values.length !== size * size * size * 3) {
    throw new Error(
      `Expected ${size ** 3 * 3} values, got ${values.length} — file may be truncated`,
    );
  }

  return {
    size,
    data: Float32Array.from(values),
    domainMin,
    domainMax,
  };
};
