// Boosts saturation more on muted pixels than on already-saturated ones.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float sat = mx - mn;
  float boost = u_amount * (1.0 - sat);
  vec3 rgb = mix(vec3(l), c.rgb, 1.0 + boost);
  fragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}
`;
