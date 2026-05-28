# AI subsystem

cut_editor's biggest differentiator. Every feature here must:

1. **Run locally first.** A user with no network should still get value.
2. **Be opt-in.** Models download lazily on first use; show size + license.
3. **Be cancellable.** Long-running jobs return an `AbortController`-friendly
   handle and a progress stream.
4. **Produce reversible edits.** AI suggestions become regular commands
   pushed through the history store, so users can undo at clip granularity.

## Modules (target shapes)

- `transcribe.ts` — Whisper via `@huggingface/transformers` (`onnx`/wasm
  backend). Outputs `[{ start, end, text, lang, confidence }]` per asset.
- `silence-detect.ts` — sliding RMS over a decoded audio buffer; returns
  ranges. Drives "Auto silence removal" by emitting `splitClipAt` +
  `removeClip` commands for ranges below threshold.
- `scene-detect.ts` — frame-difference + histogram chi-square test in a
  Web Worker. Outputs `[{ atMs, score }]`. Drives "Auto split scenes".
- `bgrm.ts` — MediaPipe Selfie Segmentation (WASM) per frame, producing a
  mask texture consumed by the effects renderer (`bg-remove` shader).
- `smart-reframe.ts` — saliency detector picks an attention window over
  time; produces keyframes on `transform.x` to re-target to 9:16/1:1.
- `color-match.ts` — sample mean Lab from a reference clip, build a 3D LUT,
  apply as a `color-lut` effect to target clips.

## Subsystem interface

```ts
export interface AiTask<TResult> {
  readonly id: string;
  readonly label: string;
  readonly progress: ReadableStream<number>; // 0..1
  readonly result: Promise<TResult>;
  readonly cancel: () => void;
}

export interface AiProvider {
  transcribe(asset: MediaAsset, opts?: { lang?: string }): AiTask<Subtitle[]>;
  detectSilence(asset: MediaAsset, opts?: SilenceOpts): AiTask<Range[]>;
  detectScenes(asset: MediaAsset): AiTask<SceneCut[]>;
}
```

A `LocalProvider` ships in the box; a `CloudProvider` (Replicate/fal/Modal)
plugs in behind the same interface for users who want speed.
