// GLSL fragments shared by the two composite paths (blit and blend-modes).
// Both paths draw the same clip with the same mask and the same wipe, so the
// code for them lives here once. They used to be copy-pasted, and drifted:
// the ellipse feather compared squared distance in one file and linear
// distance in the other, so an identical mask rendered differently depending
// on the clip's blend mode. Composing from one string makes that class of
// divergence impossible rather than merely fixed.

// Wipe: u_wipe_mode 0 = off, 1 left, 2 right, 3 up, 4 down, 5 circle.
export const WIPE_UNIFORMS = /* glsl */ `
uniform int u_wipe_mode;
uniform float u_wipe_progress;
uniform float u_wipe_softness;`;

// Vector mask: u_mask_shape 0 = off, 1 rect, 2 ellipse.
export const MASK_UNIFORMS = /* glsl */ `
uniform int u_mask_shape;
uniform vec4 u_mask_rect;
uniform float u_mask_feather;
uniform int u_mask_inverted;`;

export const WIPE_FN = /* glsl */ `
float wipeMask(vec2 uv) {
  float p = u_wipe_progress;
  float s = max(0.001, u_wipe_softness);
  if (u_wipe_mode == 1) return smoothstep(uv.x - s, uv.x + s, p);
  if (u_wipe_mode == 2) return smoothstep((1.0 - uv.x) - s, (1.0 - uv.x) + s, p);
  if (u_wipe_mode == 3) return smoothstep((1.0 - uv.y) - s, (1.0 - uv.y) + s, p);
  if (u_wipe_mode == 4) return smoothstep(uv.y - s, uv.y + s, p);
  if (u_wipe_mode == 5) {
    float d = distance(uv, vec2(0.5)) * 1.4142;
    return smoothstep(d - s, d + s, p);
  }
  return 1.0;
}`;

export const MASK_FN = /* glsl */ `
float vectorMask(vec2 uv) {
  if (u_mask_shape == 0) return 1.0;
  float f = max(0.001, u_mask_feather);
  float inside;
  if (u_mask_shape == 1) {
    vec2 a = smoothstep(u_mask_rect.xy - f, u_mask_rect.xy + f, uv);
    vec2 b = smoothstep(u_mask_rect.xy + u_mask_rect.zw - f, u_mask_rect.xy + u_mask_rect.zw + f, uv);
    inside = a.x * a.y * (1.0 - b.x) * (1.0 - b.y);
  } else {
    vec2 center = u_mask_rect.xy + u_mask_rect.zw * 0.5;
    vec2 rad = max(u_mask_rect.zw * 0.5, vec2(0.001));
    float dist = length((uv - center) / rad);
    inside = 1.0 - smoothstep(1.0 - f * 4.0, 1.0, dist);
  }
  return u_mask_inverted == 1 ? 1.0 - inside : inside;
}`;
