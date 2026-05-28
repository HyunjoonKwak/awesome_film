// Rotates the chrominance plane (YIQ I/Q) by u_degrees; preserves luminance.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_degrees;
out vec4 fragColor;
vec3 rgb2yiq(vec3 c) {
  return mat3(0.299, 0.596, 0.211, 0.587,-0.274,-0.523, 0.114,-0.322, 0.312) * c;
}
vec3 yiq2rgb(vec3 c) {
  return mat3(1.0, 1.0, 1.0, 0.956,-0.272,-1.106, 0.621,-0.647, 1.703) * c;
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 yiq = rgb2yiq(c.rgb);
  float a = radians(u_degrees);
  float ca = cos(a), sa = sin(a);
  vec3 rot = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
  fragColor = vec4(clamp(yiq2rgb(rot), 0.0, 1.0), c.a);
}
`;
