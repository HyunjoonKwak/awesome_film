// Composites a foreground over a captured backdrop for every blend mode that
// fixed-function GL blending cannot express. The backdrop is sampled in screen
// space via gl_FragCoord so a transformed quad still picks up the correct
// underlying pixels. Output is premultiplied so the standard over-blend yields
// mix(backdrop, blend, a).
//
// One program handles all twelve modes: u_mode is a uniform, so the branch is
// warp-uniform and the registry's cached uniform locations stay valid. The
// integer values are assigned in BACKDROP_BLEND_MODE (compositor-uniforms.ts)
// and a test asserts every mode there has a matching case below.
//
// Precision is highp rather than the mediump the other shaders use: color-dodge
// and color-burn divide by (1 - f) and f, which mediump cannot resolve near the
// singularity. The divisions are also guarded, so the precision bump only buys
// accuracy approaching the limit, not the limit itself.
import { MASK_FN, MASK_UNIFORMS, WIPE_FN, WIPE_UNIFORMS } from "./common";

export const fs = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;       // foreground
uniform sampler2D u_backdrop;  // captured screen
uniform vec2 u_resolution;
uniform float u_opacity;
uniform int u_mode;
${WIPE_UNIFORMS}
${MASK_UNIFORMS}
out vec4 fragColor;
${WIPE_FN}
${MASK_FN}

// --- separable modes ------------------------------------------------------
// b = backdrop, f = foreground, both straight (non-premultiplied) in 0..1.

vec3 hardLight(vec3 b, vec3 f) {
  return mix(2.0 * b * f, 1.0 - 2.0 * (1.0 - b) * (1.0 - f), step(0.5, f));
}
// Overlay is hard-light with the operands exchanged.
vec3 overlay(vec3 b, vec3 f) {
  return hardLight(f, b);
}
vec3 softLight(vec3 b, vec3 f) {
  return mix(
    2.0 * b * f + b * b * (1.0 - 2.0 * f),
    sqrt(b) * (2.0 * f - 1.0) + 2.0 * b * (1.0 - f),
    step(0.5, f)
  );
}
float dodge1(float b, float f) {
  if (b <= 0.0) return 0.0;
  if (f >= 1.0) return 1.0;
  return min(1.0, b / max(1.0 - f, 1e-5));
}
float burn1(float b, float f) {
  if (b >= 1.0) return 1.0;
  if (f <= 0.0) return 0.0;
  return 1.0 - min(1.0, (1.0 - b) / max(f, 1e-5));
}
vec3 colorDodge(vec3 b, vec3 f) {
  return vec3(dodge1(b.r, f.r), dodge1(b.g, f.g), dodge1(b.b, f.b));
}
vec3 colorBurn(vec3 b, vec3 f) {
  return vec3(burn1(b.r, f.r), burn1(b.g, f.g), burn1(b.b, f.b));
}

// --- non-separable modes --------------------------------------------------
// Luminosity/saturation helpers from the W3C compositing spec. These operate on
// the colour as a whole, which is why they need their own machinery.

float lum(vec3 c) {
  return dot(c, vec3(0.3, 0.59, 0.11));
}
// Pulls a colour back into gamut around its own luminosity.
vec3 clipColor(vec3 c) {
  float l = lum(c);
  float n = min(min(c.r, c.g), c.b);
  float x = max(max(c.r, c.g), c.b);
  if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-5);
  if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-5);
  return c;
}
vec3 setLum(vec3 c, float l) {
  return clipColor(c + (l - lum(c)));
}
float sat(vec3 c) {
  return max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
}
// Rescales the channel spread to s, keeping the mid channel proportional.
vec3 setSat(vec3 c, float s) {
  float mn = min(min(c.r, c.g), c.b);
  float mx = max(max(c.r, c.g), c.b);
  return mx > mn ? (c - mn) * s / (mx - mn) : vec3(0.0);
}

vec3 blendFor(vec3 b, vec3 f) {
  if (u_mode == 0) return overlay(b, f);
  if (u_mode == 1) return softLight(b, f);
  if (u_mode == 2) return min(b, f);
  if (u_mode == 3) return max(b, f);
  if (u_mode == 4) return hardLight(b, f);
  if (u_mode == 5) return colorDodge(b, f);
  if (u_mode == 6) return colorBurn(b, f);
  if (u_mode == 7) return abs(b - f);
  if (u_mode == 8) return b + f - 2.0 * b * f;
  if (u_mode == 9) return setLum(setSat(f, sat(b)), lum(b));
  if (u_mode == 10) return setLum(setSat(b, sat(f)), lum(b));
  if (u_mode == 11) return setLum(f, lum(b));
  if (u_mode == 12) return setLum(b, lum(f));
  return overlay(b, f); // out-of-range guard; every valid mode is listed above
}

void main() {
  vec4 fg = texture(u_tex, v_uv);
  // Blend maths is defined on straight colour; the pipeline is premultiplied.
  // Without this the semi-transparent edges of text, feathered masks and keyed
  // footage blend as if they were darker than they are.
  vec3 fgc = fg.a > 0.0 ? clamp(fg.rgb / fg.a, 0.0, 1.0) : vec3(0.0);
  vec2 buv = gl_FragCoord.xy / u_resolution;
  vec3 bd = texture(u_backdrop, buv).rgb;
  vec3 blended = clamp(blendFor(bd, fgc), 0.0, 1.0);
  float wm = u_wipe_mode == 0 ? 1.0 : wipeMask(v_uv);
  float a = clamp(fg.a * u_opacity * wm * vectorMask(v_uv), 0.0, 1.0);
  fragColor = vec4(blended * a, a);
}
`;
