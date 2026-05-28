// Channel-mixer white balance: u_temp (blue↔amber), u_tint (green↔magenta).
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_temp;
uniform float u_tint;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 rgb = c.rgb;
  rgb.r += u_temp * 0.15;
  rgb.b -= u_temp * 0.15;
  rgb.g -= u_tint * 0.15;
  rgb.r += u_tint * 0.075;
  rgb.b += u_tint * 0.075;
  fragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
`;
