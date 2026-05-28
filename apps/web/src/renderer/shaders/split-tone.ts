// Tints shadows and highlights toward separate colors (e.g. teal/orange).
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec3 u_shadow;
uniform vec3 u_highlight;
uniform float u_amount;
uniform float u_balance;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float pivot = clamp(0.5 + u_balance, 0.05, 0.95);
  float hi = smoothstep(0.0, pivot, l);
  float lo = 1.0 - hi;
  vec3 tint = u_shadow * lo + u_highlight * hi;
  vec3 graded = mix(c.rgb, c.rgb * 0.5 + tint * 0.5, u_amount);
  fragColor = vec4(clamp(graded, 0.0, 1.0), c.a);
}
`;
