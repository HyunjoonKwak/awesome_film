export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_stops;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  fragColor = vec4(clamp(c.rgb * pow(2.0, u_stops), 0.0, 1.0), c.a);
}
`;
