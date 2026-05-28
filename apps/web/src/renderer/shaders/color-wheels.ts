// 3-way color corrector: lift (shadows), gamma (midtones), gain (highlights).
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec3 u_lift;   // shadow offset
uniform vec3 u_gamma;  // midtone power bias
uniform vec3 u_gain;   // highlight multiplier
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 col = c.rgb;
  // Gain (highlights): scale around black.
  col *= (vec3(1.0) + u_gain);
  // Lift (shadows): offset that fades toward highlights.
  col += u_lift * (vec3(1.0) - col);
  // Gamma (midtones): exponent shift, clamp exponent to a sane range.
  vec3 g = vec3(1.0) / max(vec3(0.1), vec3(1.0) + u_gamma);
  col = pow(clamp(col, 0.0, 1.0), g);
  fragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}
`;
