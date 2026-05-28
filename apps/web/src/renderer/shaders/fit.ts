// Spatial conform: resamples the source with a centered UV scale so it covers
// (fill, scale < 1 crops) or is contained (fit, scale > 1 letterboxes). Pixels
// outside the source read as transparent so "fit" shows clean bars.
export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_uv_scale;
out vec4 fragColor;
void main() {
  vec2 uv = (v_uv - 0.5) * u_uv_scale + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0);
  } else {
    fragColor = texture(u_tex, uv);
  }
}
`;
