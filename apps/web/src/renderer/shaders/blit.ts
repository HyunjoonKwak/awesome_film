// Composite pass-through: handles per-clip opacity, the directional wipe
// transition (u_wipe_*), and the vector mask (u_mask_*). Used as the final
// "blit" program by the compositor.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
// Wipe: u_wipe_mode 0 = off, 1 left, 2 right, 3 up, 4 down, 5 circle.
uniform int u_wipe_mode;
uniform float u_wipe_progress;
uniform float u_wipe_softness;
// Vector mask: u_mask_shape 0 = off, 1 rect, 2 ellipse.
uniform int u_mask_shape;
uniform vec4 u_mask_rect;
uniform float u_mask_feather;
uniform int u_mask_inverted;
out vec4 fragColor;

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
}

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
}

void main() {
  vec4 c = texture(u_tex, v_uv);
  float wm = u_wipe_mode == 0 ? 1.0 : wipeMask(v_uv);
  float vm = vectorMask(v_uv);
  fragColor = vec4(c.rgb, c.a * u_opacity * wm * vm);
}
`;
