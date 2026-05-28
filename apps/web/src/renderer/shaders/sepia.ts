export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  vec3 sep = vec3(
    dot(c.rgb, vec3(0.393, 0.769, 0.189)),
    dot(c.rgb, vec3(0.349, 0.686, 0.168)),
    dot(c.rgb, vec3(0.272, 0.534, 0.131))
  );
  fragColor = vec4(mix(c.rgb, sep, u_amount), c.a);
}
`;
