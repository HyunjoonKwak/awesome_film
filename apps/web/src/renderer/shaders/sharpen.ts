// 5-tap cross unsharp mask.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
uniform vec2 u_texel;
out vec4 fragColor;
void main() {
  vec4 c  = texture(u_tex, v_uv);
  vec4 n  = texture(u_tex, v_uv + vec2(0.0, -u_texel.y));
  vec4 s  = texture(u_tex, v_uv + vec2(0.0,  u_texel.y));
  vec4 e  = texture(u_tex, v_uv + vec2( u_texel.x, 0.0));
  vec4 w  = texture(u_tex, v_uv + vec2(-u_texel.x, 0.0));
  vec3 sharp = c.rgb * (1.0 + 4.0 * u_amount) - (n.rgb + s.rgb + e.rgb + w.rgb) * u_amount;
  fragColor = vec4(clamp(sharp, 0.0, 1.0), c.a);
}
`;
