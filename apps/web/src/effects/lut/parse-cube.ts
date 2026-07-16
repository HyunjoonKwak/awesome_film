// Minimal Adobe .cube parser. We handle the common cases:
//   - 1D LUTs of size 2..16384
//   - 3D LUTs of size 2..64
//   - DOMAIN_MIN / DOMAIN_MAX defaulting to 0..1
// Header keys are case-insensitive; comments start with `#`.

export interface CubeLut {
  readonly dimension: 1 | 3;
  readonly size: number;       // grid side length
  readonly data: Float32Array; // size * 3 (1D) or size^3 * 3 (3D, B slowest)
  readonly domainMin: readonly [number, number, number];
  readonly domainMax: readonly [number, number, number];
}

export const parseCube = (text: string): CubeLut => {
  let size = 0;
  let dimension: 1 | 3 | 0 = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const values: number[] = [];

  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.split("#")[0]!.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower.startsWith("title")) continue;
    if (lower.startsWith("lut_3d_size")) {
      if (dimension !== 0) throw new Error("A .cube file must declare exactly one LUT size");
      dimension = 3;
      size = Number(line.split(/\s+/)[1]);
      continue;
    }
    if (lower.startsWith("lut_1d_size")) {
      if (dimension !== 0) throw new Error("A .cube file must declare exactly one LUT size");
      dimension = 1;
      size = Number(line.split(/\s+/)[1]);
      continue;
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

  if (dimension === 0 || !Number.isInteger(size)) throw new Error("LUT_1D_SIZE or LUT_3D_SIZE missing");
  const maxSize = dimension === 1 ? 16_384 : 64;
  if (size < 2 || size > maxSize) {
    throw new Error(`${dimension}D LUT size must be between 2 and ${maxSize}`);
  }
  if (
    !domainMin.every(Number.isFinite) ||
    !domainMax.every(Number.isFinite) ||
    domainMax.some((value, index) => value <= domainMin[index]!)
  ) {
    throw new Error("LUT domain bounds must be finite and increasing");
  }
  const expectedValues = (dimension === 1 ? size : size ** 3) * 3;
  if (values.length !== expectedValues) {
    throw new Error(
      `Expected ${expectedValues} values, got ${values.length} — file may be truncated`,
    );
  }

  return {
    dimension,
    size,
    data: Float32Array.from(values),
    domainMin,
    domainMax,
  };
};
