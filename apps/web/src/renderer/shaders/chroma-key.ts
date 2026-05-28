// Distance-in-chroma keyer with spill suppression along the key colour axis.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec3 u_key_color;
uniform float u_similarity;
uniform float u_smoothness;
uniform float u_spill;
out vec4 fragColor;
vec3 rgb2yuv(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  return vec3(y, c.b - y, c.r - y);
}
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 keyY = rgb2yuv(u_key_color);
  vec3 pixY = rgb2yuv(c.rgb);
  float dist = distance(pixY.yz, keyY.yz);
  float alpha = smoothstep(u_similarity, u_similarity + u_smoothness, dist);
  vec3 rgb = c.rgb;
  float keyDom = dot(normalize(u_key_color + 1e-5), normalize(c.rgb + 1e-5));
  if (keyDom > 0.0) {
    float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    rgb = mix(c.rgb, vec3(l), u_spill * keyDom);
  }
  fragColor = vec4(rgb, c.a * alpha);
}
`;
