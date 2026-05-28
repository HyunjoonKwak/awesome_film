// 3D LUT sampled from a 2D strip texture (HALD-style: size×size cells of
// size×size each). Bilinear in RG, linear in blue between two cells.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform sampler2D u_lut;
uniform float u_lut_size;
uniform float u_intensity;
out vec4 fragColor;
vec3 sampleLut(vec3 rgb) {
  float blueIdx = rgb.b * (u_lut_size - 1.0);
  float floorB = floor(blueIdx);
  float frac = blueIdx - floorB;
  vec2 stripSize = vec2(u_lut_size * u_lut_size, u_lut_size);
  vec2 cell0 = vec2(floorB * u_lut_size, 0.0);
  vec2 cell1 = vec2(min(floorB + 1.0, u_lut_size - 1.0) * u_lut_size, 0.0);
  vec2 uv = vec2(rgb.r, rgb.g) * (u_lut_size - 1.0) + 0.5;
  vec3 c0 = texture(u_lut, (cell0 + uv) / stripSize).rgb;
  vec3 c1 = texture(u_lut, (cell1 + uv) / stripSize).rgb;
  return mix(c0, c1, frac);
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 mapped = sampleLut(clamp(c.rgb, 0.0, 1.0));
  fragColor = vec4(mix(c.rgb, mapped, u_intensity), c.a);
}
`;
