// Classic levels: remap [u_black, u_white] to [0,1] then apply midtone gamma.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_black;
uniform float u_white;
uniform float u_gamma;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float range = max(0.001, u_white - u_black);
  vec3 n = clamp((c.rgb - u_black) / range, 0.0, 1.0);
  n = pow(n, vec3(1.0 / max(0.01, u_gamma)));
  fragColor = vec4(n, c.a);
}
`;
