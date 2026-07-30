// Composite pass-through: handles per-clip opacity, the directional wipe
// transition (u_wipe_*), and the vector mask (u_mask_*). Used as the final
// "blit" program by the compositor. The wipe and mask code is shared with
// blend-modes.ts so the two composite paths cannot drift apart.
import { MASK_FN, MASK_UNIFORMS, WIPE_FN, WIPE_UNIFORMS } from "./common";

export const fs = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_opacity;
${WIPE_UNIFORMS}
${MASK_UNIFORMS}
out vec4 fragColor;
${WIPE_FN}
${MASK_FN}

void main() {
  vec4 c = texture(u_tex, v_uv);
  float wm = u_wipe_mode == 0 ? 1.0 : wipeMask(v_uv);
  float vm = vectorMask(v_uv);
  fragColor = vec4(c.rgb, c.a * u_opacity * wm * vm);
}
`;
