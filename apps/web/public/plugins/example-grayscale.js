// cut_editor sample plugin — turns the frame greyscale.
// Save the URL of this file to localStorage["cut.plugins"] as a JSON array
// to have the editor load it on next boot.
//
//   localStorage.setItem("cut.plugins", JSON.stringify(["/plugins/example-grayscale.js"]))
//
// Plugins execute in a sandboxed iframe and can only register serializable
// effect/shader definitions through the v2 SDK.

const { registerEffect, registerShader } = window.cutEditor;

registerShader(
  "grayscale",
  `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_amount;
out vec4 fragColor;
void main() {
  vec4 c = texture(u_tex, v_uv);
  float g = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  fragColor = vec4(mix(c.rgb, vec3(g), u_amount), c.a);
}
`,
);

registerEffect({
  type: "grayscale",
  name: "Grayscale (plugin)",
  keywords: ["mono", "desaturate"],
  category: "color",
  params: [
    { kind: "number", key: "amount", label: "Amount", min: 0, max: 1, step: 0.01, default: 1 },
  ],
  passes: [
    {
      shader: "grayscale",
      // A string binding reads the named effect parameter at render time.
      uniforms: { u_amount: "amount" },
    },
  ],
});
