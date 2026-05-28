export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float k = 1.0 + u_amount;
  fragColor = vec4(clamp((c.rgb - 0.5) * k + 0.5, 0.0, 1.0), c.a);
}
`;
