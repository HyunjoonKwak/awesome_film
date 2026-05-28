# Vendored MediaPipe assets

**English** · [한국어](README.ko.md)

Local copies of the MediaPipe Tasks Vision runtime + Selfie Segmenter model.
Vendored here so the background-removal feature works fully offline (no
runtime hits to `cdn.jsdelivr.net` or `storage.googleapis.com`) and is
ready to ship inside the Electron bundle.

## Layout

```
mediapipe/
├── wasm/
│   ├── vision_wasm_internal.{js,wasm}
│   ├── vision_wasm_module_internal.{js,wasm}
│   └── vision_wasm_nosimd_internal.{js,wasm}
└── models/
    └── selfie_segmenter.tflite       # ~244 KB
```

## How to refresh

These files come from:

- **wasm runtime** → `node_modules/@mediapipe/tasks-vision/wasm/`
  (matches the installed `@mediapipe/tasks-vision` version — currently
  `0.10.35` per `apps/web/package.json`).
- **selfie_segmenter.tflite** →
  `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`

To refresh after a `@mediapipe/tasks-vision` upgrade:

```bash
pnpm install
cp node_modules/.pnpm/@mediapipe+tasks-vision@*/node_modules/@mediapipe/tasks-vision/wasm/* \
   apps/web/public/mediapipe/wasm/
curl -sSL -o apps/web/public/mediapipe/models/selfie_segmenter.tflite \
   https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
```

The loader in `apps/web/src/ai/bg-remove.ts` reads from these paths via
`FilesetResolver.forVisionTasks("/mediapipe/wasm")` and
`baseOptions.modelAssetPath: "/mediapipe/models/selfie_segmenter.tflite"`.

## License

Both the wasm runtime and the Selfie Segmenter model are distributed by
Google under the **Apache License 2.0**. See
[MediaPipe license](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE)
for the runtime and the model card linked from the file URL above for the
model weights.
