// Hashed noise overlay. u_time animates the seed so successive frames flicker
// rather than holding the same pattern.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
uniform float u_time;
out vec4 fragColor;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_time) * 43758.5453);
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  float n = (hash(v_uv * 1024.0) - 0.5) * u_amount;
  fragColor = vec4(clamp(c.rgb + n, 0.0, 1.0), c.a);
}
`;
