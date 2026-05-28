export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_intensity;
uniform float u_softness;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec2 from_center = v_uv - 0.5;
  float d = length(from_center) * 1.4142;
  float r = mix(1.0 - u_intensity, 1.0, smoothstep(0.5 - u_softness * 0.5, 1.0, 1.0 - d));
  fragColor = vec4(c.rgb * r, c.a);
}
`;
