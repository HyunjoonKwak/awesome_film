// 1D Gaussian; the caller runs two passes (horizontal then vertical) by
// flipping u_direction. Kernel is fixed at 17 taps with sigma scaling.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_direction;
uniform float u_sigma;
uniform vec2 u_texel;
out vec4 fragColor;
void main() {
  if (u_sigma <= 0.0) { fragColor = texture(u_tex, v_uv); return; }
  float total = 0.0;
  vec3 acc = vec3(0.0);
  for (int i = -8; i <= 8; i++) {
    float fi = float(i);
    float w = exp(-(fi*fi) / (2.0 * u_sigma * u_sigma));
    vec2 offset = u_direction * u_texel * fi * (1.0 + u_sigma * 0.4);
    acc += texture(u_tex, v_uv + offset).rgb * w;
    total += w;
  }
  fragColor = vec4(acc / total, texture(u_tex, v_uv).a);
}
`;
