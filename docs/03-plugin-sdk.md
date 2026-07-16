# Plugin SDK

cut_editor is open at runtime — third parties can ship effects and shaders
without rebuilding the editor. The surface is intentionally tiny:

```ts
window.cutEditor = {
  version: 1,
  registerEffect(def: EffectDefinition): void;
  unregisterEffect(type: string): void;
  registerShader(id: string, fragmentSource: string): void;
};
```

## Distribution

Drop a JS file anywhere reachable from the browser (CDN, your own static
server, even `apps/web/public/plugins/`) and tell users to add the URL to
their plugin list:

```js
localStorage.setItem(
  "cut.plugins",
  JSON.stringify(["/plugins/example-grayscale.js"]),
);
```

The editor loads everything in that list once per session.

## Minimal example

See [`apps/web/public/plugins/example-grayscale.js`](../apps/web/public/plugins/example-grayscale.js)
for a working example that adds a tunable greyscale effect.

## Shader expectations

Plugin shaders are GLSL ES 3.0 fragment shaders. The renderer guarantees:

- `vec2 v_uv` is the interpolated UV
- `sampler2D u_tex` is the current pass input
- `float u_opacity` and `vec4 u_dest` may be present (set them or ignore)
- `vec2 u_texel` is `1/width, 1/height` of the input
- For `bg-remove`-style passes, `sampler2D u_mask` and `int u_has_mask` are
  also available

All other uniforms come from the `uniforms()` function on the pass definition.

## Roadmap

- Per-plugin sandboxed iframes for untrusted plugins
- Plugin registry / marketplace
- WGSL shader support once we move the renderer to WebGPU
