# OpenCut Research Notes

Source: <https://github.com/OpenCut-app/OpenCut> (cloned to `reference/`)

OpenCut positions itself as the open-source CapCut alternative. It is a serious,
production-grade editor with a hybrid TypeScript + Rust/WASM architecture.

## Tech stack

- **App shell**: Next.js 16 + React 19, Tailwind 4, shadcn/Radix UI
- **State**: Zustand stores (per domain: `editor`, `timeline`, `preview`, `panel`, ...)
- **Monorepo**: Bun + Turbo (`apps/web`, `apps/desktop`, `rust/`)
- **Desktop**: GPUI (Rust-native), in-progress
- **Native core**: Rust crates under `rust/crates/` + `rust/wasm` exposing
  bindings via `opencut-wasm`. Houses GPU compositor (wgpu/WGSL), effects,
  masks, retime DSP.
- **Media I/O**: `mediabunny` (WebCodecs-based demux/mux), `wavesurfer.js`
  for waveforms, `soundtouchjs` for pitch-preserving speed.
- **AI**: `@huggingface/transformers` for in-browser transcription/inference.
- **Persistence**: Drizzle ORM + Postgres, `better-auth`, Upstash Redis for
  rate-limiting, Cloudflare deployment via OpenNext.

## Domain modules in `apps/web/src`

```
animation/   audio-separation in timeline/    canvas/
clipboard/   commands/         core/          data/
db/          editor/           effects/       export/
fonts/       fps/              gradients/     graphics/
masks/       media/            panels/        params/
preview/     project/          rendering/     retime/
ripple/      selection/        services/      site/
stickers/    subtitles/        text/          timeline/
transcription/  wasm/
```

Each domain owns a Zustand store plus React hooks/components. The split is by
**domain** (`timeline`, `preview`, `media`) rather than by **kind**
(`components`, `hooks`, `stores`) — see `notes/primitives-vs-domains.md`.

## GPU effects pipeline (key insight)

`docs/effects-renderer.md` describes a clean separation:

1. TS resolves an `EffectDefinition` → ordered `EffectPass[]`
2. Each pass is `{ shader: string, uniforms: object }`
3. Rust/wgpu owns `shader_registry.rs` and pipeline execution
4. Multi-pass effects (blur H+V, bloom, glow) and dynamic pass counts
   (`buildPasses(...)`) are first-class

This is a great template: TS decides "what", WGSL decides "how".

## Timeline subsystem (most complex)

`timeline/` is enormous — `timeline-store.ts`, multiple update-pipelines,
group-move/resize, magnetic snapping (`snapping/`, `playhead-snap-source`,
`element-snap-source`, `animation-snap-points`), bookmarks/scenes, ripple,
retime, audio-separation, drag-source/utils, placement helpers, pixel-utils,
ruler-utils, zoom-utils, track-capabilities. Tests live in `__tests__`.

## Media subsystem

- `media/use-file-upload.ts` + `use-paste-media.ts` — ingress
- `media/mediabunny.ts` — WebCodecs wrapper
- `media/thumbnail.ts`, `waveform-summary.ts` — preview generation
- `media/audio-mastering.ts`, `processing.ts` — post-ingest pipeline

## What OpenCut already nails

- Solid multi-track timeline with grouping, snapping, ripple, retime
- GPU effects with WGSL shaders + multi-pass support
- WebCodecs-first media pipeline (no FFmpeg for ingest)
- Browser-native transcription (HF transformers)
- Cloud auth/storage, desktop & web parity goal

## What is still thin (our differentiation opportunities)

- No real-time collaboration
- AI features focused on transcription; missing: scene detect, auto-cut,
  silence removal, color match, motion tracking, background removal
- Magnetic timeline (FCP-style) is not the default model
- No plugin/marketplace surface for community effects
- Project versioning / history is local-state only
- Mobile UX is web-responsive, not gesture-native
