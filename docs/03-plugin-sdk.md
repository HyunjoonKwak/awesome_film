# Plugin SDK

cut_editor supports runtime shader effects without granting plugin code access
to the editor origin. Every configured plugin is fetched by the host and then
executed in a hidden `sandbox="allow-scripts"` iframe with an opaque origin.
Plugins cannot read project state, OPFS, local storage, cookies, or the Electron
preload bridge. The iframe CSP also blocks network, image, and media requests,
so plugins must be distributed as a single JavaScript bundle. Only validated,
serializable SDK messages cross the boundary.

```ts
window.cutEditor = {
  version: 2,
  registerEffect(definition: SandboxedEffectDefinition): void;
  unregisterEffect(type: string): void;
  registerShader(id: string, fragmentSource: string): void;
  unregisterShader(id: string): void;
};
```

## Distribution

Host the JavaScript on HTTPS with CORS enabled, or serve it from the editor's
own origin. Plain HTTP is accepted only on loopback hosts. Plugin files are
limited to 256 KiB and shader sources to 128 KiB.

```js
localStorage.setItem(
  "cut.plugins",
  JSON.stringify(["/plugins/example-grayscale.js"]),
);
```

The editor fetches and starts each configured plugin once per session. Removing
a plugin frame unregisters every effect and shader that frame registered.

## Effect definitions

Definitions must be structured-cloneable. In particular, pass `uniforms` is a
record rather than a JavaScript callback:

```js
cutEditor.registerEffect({
  type: "grayscale",
  name: "Grayscale",
  keywords: ["mono"],
  category: "color",
  params: [
    { kind: "number", key: "amount", label: "Amount", min: 0, max: 1, step: 0.01, default: 1 },
  ],
  passes: [
    {
      shader: "grayscale",
      uniforms: {
        u_amount: "amount", // bind to a parameter
        u_constant: 1,      // fixed scalar
        u_vector: [1, 0],   // fixed numeric vector
      },
    },
  ],
});
```

See [`apps/web/public/plugins/example-grayscale.js`](../apps/web/public/plugins/example-grayscale.js)
for a complete working plugin.

## Shader expectations

Plugin shaders are GLSL ES 3.0 fragment shaders. The renderer guarantees:

- `vec2 v_uv` is the interpolated UV
- `sampler2D u_tex` is the current pass input
- `float u_opacity` and `vec4 u_dest` may be present
- `vec2 u_texel` is `1/width, 1/height` of the input
- Background-removal passes may use `sampler2D u_mask` and `int u_has_mask`

## Remaining SDK roadmap

- Signed registry / marketplace metadata
- WGSL shader support after a WebGPU renderer is available
