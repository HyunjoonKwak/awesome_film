// Composites foreground over a captured backdrop using overlay (u_mode 0)
// or soft-light (u_mode 1). Backdrop sampled in screen space via gl_FragCoord
// so the transformed quad still picks the correct underlying pixels. Output
// is premultiplied so the standard over-blend yields mix(backdrop, blend, a).
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;       // foreground
uniform sampler2D u_backdrop;  // captured screen
uniform vec2 u_resolution;
uniform float u_opacity;
uniform int u_mode;            // 0 overlay, 1 soft-light
// Vector mask (matches passThru).
uniform int u_mask_shape;
uniform vec4 u_mask_rect;
uniform float u_mask_feather;
uniform int u_mask_inverted;
out vec4 fragColor;

float maskFactor(vec2 uv) {
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
    vec2 d = (uv - center) / rad;
    inside = 1.0 - smoothstep(1.0 - f * 4.0, 1.0, dot(d, d));
  }
  return u_mask_inverted == 1 ? 1.0 - inside : inside;
}

vec3 overlay(vec3 b, vec3 f) {
  return mix(2.0 * b * f, 1.0 - 2.0 * (1.0 - b) * (1.0 - f), step(0.5, b));
}
vec3 softLight(vec3 b, vec3 f) {
  return mix(
    2.0 * b * f + b * b * (1.0 - 2.0 * f),
    sqrt(b) * (2.0 * f - 1.0) + 2.0 * b * (1.0 - f),
    step(0.5, f)
  );
}

void main() {
  vec4 fg = texture(u_tex, v_uv);
  vec2 buv = gl_FragCoord.xy / u_resolution;
  vec3 bd = texture(u_backdrop, buv).rgb;
  vec3 blended = u_mode == 1 ? softLight(bd, fg.rgb) : overlay(bd, fg.rgb);
  float a = clamp(fg.a * u_opacity * maskFactor(v_uv), 0.0, 1.0);
  fragColor = vec4(blended * a, a);
}
`;
