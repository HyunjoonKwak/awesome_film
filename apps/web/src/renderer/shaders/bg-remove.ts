// Applies a precomputed segmentation mask (single-channel) as alpha.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform sampler2D u_mask;
uniform float u_feather;
uniform int u_has_mask;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  if (u_has_mask == 0) { fragColor = c; return; }
  float m = texture(u_mask, v_uv).r;
  float a = smoothstep(0.5 - u_feather, 0.5 + u_feather, m);
  fragColor = vec4(c.rgb, c.a * a);
}
`;
