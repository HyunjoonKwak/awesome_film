// Default pass-through vertex shader. All effect passes share this VS;
// uniqueness lives in the fragment shader.
//
// `u_dest` keeps the legacy "place this quad at normalized rect" semantics
// for effect passes that operate on the full ping-pong target.
//
// `u_transform_*` are used by the final composite pass when a clip has
// position / scale / rotation; the shader applies an affine 2D transform
// in NDC. When unused (effect passes), the identity values are written.
export const VS_QUAD = /* glsl */ `#version 300 es
layout(location=0) in vec2 a_pos;
layout(location=1) in vec2 a_uv;
uniform vec4 u_dest;                  // [x, y, w, h] in [0,1]^2 (effects)
uniform vec2 u_translate;             // composite-only
uniform float u_scale;                // composite-only
uniform float u_rotation;             // composite-only (radians)
uniform float u_aspect;               // dst w/h for rotation correction
out vec2 v_uv;
void main() {
  vec2 p = (a_pos * 0.5 + 0.5) * u_dest.zw + u_dest.xy;
  // Move to NDC, then apply transform around (0,0).
  vec2 ndc = p * 2.0 - 1.0;
  // Scale in NDC, correcting for aspect so a square stays square at rot=0.
  ndc *= u_scale;
  // Rotate (also aspect-corrected).
  if (u_rotation != 0.0) {
    vec2 a = vec2(ndc.x * u_aspect, ndc.y);
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    vec2 r = vec2(a.x * c - a.y * s, a.x * s + a.y * c);
    ndc = vec2(r.x / u_aspect, r.y);
  }
  ndc += u_translate;
  gl_Position = vec4(ndc, 0.0, 1.0);
  v_uv = a_uv;
}
`;
