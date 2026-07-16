import { createTexture, type GL } from "./gl";
import { parseCube, type CubeLut } from "@/effects/lut/parse-cube";
import { BoundedResourceCache } from "./bounded-resource-cache";

// Unroll a cubic LUT into a single 2D tile strip of size (n*n) × n RGBA8.
// Easier to sample on WebGL2 without 3D textures.
const unrollToImageData = (lut: CubeLut): ImageData => {
  const n = lut.size;
  const width = n * n;
  const height = n;
  const data = new Uint8ClampedArray(width * height * 4);
  // .cube is indexed [B][G][R]; we lay out tiles left-to-right by B,
  // each tile is n×n in (R, G).
  let idx = 0;
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const px = (g * width + b * n + r) * 4;
        const v0 = lut.data[idx]!;
        const v1 = lut.data[idx + 1]!;
        const v2 = lut.data[idx + 2]!;
        data[px + 0] = Math.round(v0 * 255);
        data[px + 1] = Math.round(v1 * 255);
        data[px + 2] = Math.round(v2 * 255);
        data[px + 3] = 255;
        idx += 3;
      }
    }
  }
  return new ImageData(data, width, height);
};

// Upload (or fetch cached) LUT texture. Returns the texture + grid size for
// the shader uniform.
interface CachedLutTexture {
  readonly tex: WebGLTexture;
  readonly size: number;
  readonly raw: string;
}

const MAX_LUT_TEXTURES = 8;
const cache = new WeakMap<GL, BoundedResourceCache<string, CachedLutTexture>>();

export const uploadLutTexture = (
  gl: GL,
  lutId: string,
  rawCube: string,
): { tex: WebGLTexture; size: number } => {
  let perGl = cache.get(gl);
  if (!perGl) {
    perGl = new BoundedResourceCache(MAX_LUT_TEXTURES, (entry) => gl.deleteTexture(entry.tex));
    cache.set(gl, perGl);
  }
  const cached = perGl.get(lutId);
  if (cached?.raw === rawCube) return cached;
  const parsed = parseCube(rawCube);
  const img = unrollToImageData(parsed);
  const tex = createTexture(gl);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    img.width,
    img.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    img.data,
  );
  const entry = { tex, size: parsed.size, raw: rawCube };
  perGl.set(lutId, entry);
  return entry;
};

export const disposeLutTextures = (gl: GL): void => {
  cache.get(gl)?.clear();
  cache.delete(gl);
};
