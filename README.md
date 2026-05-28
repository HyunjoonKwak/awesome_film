# cut_editor

An open-source, AI-native, collaborative video editor for the web — built to
match Final Cut Pro's craft and CapCut's accessibility, with collaboration
and AI features neither of them ships.

> Started from a study of [OpenCut](https://github.com/OpenCut-app/OpenCut)
> (cloned into `reference/` for offline reading; not part of the build).

## Why another editor?

| | Final Cut Pro | CapCut | OpenCut | **cut_editor** |
|--|:--:|:--:|:--:|:--:|
| Open source | ❌ | ❌ | ✅ | ✅ |
| Free for everything | ❌ | partial | ✅ | ✅ |
| Browser-native | ❌ | ❌ | ✅ | ✅ |
| AI: subtitles + scene + silence | partial | ✅ | partial | ✅ |
| Local AI (Whisper, MediaPipe) | ❌ | ❌ | partial | ✅ |
| Realtime co-edit | ❌ | partial | ❌ | ✅ |
| Plugin SDK | ✅ | ❌ | ❌ | ✅ |
| Magnetic timeline + ripple | ✅ | ❌ | partial | ✅ |
| Mobile-first gestures | n/a | ✅ | ❌ | ✅ |
| Local-first persistence | partial | ❌ | partial | ✅ |

See [`docs/01-feature-matrix.md`](docs/01-feature-matrix.md) for the full
matrix and [`docs/02-architecture.md`](docs/02-architecture.md) for the
technical plan. [`docs/03-plugin-sdk.md`](docs/03-plugin-sdk.md) covers the
plugin SDK.

## What ships today

| Layer | Feature |
|--|--|
| Core model | Immutable Project / Track / Clip / Effect / Keyframe / Transition + undo/redo |
| Timeline | Multi-track, magnetic snap, ripple, trim/split/move, drag-between-tracks, pinch-zoom |
| Renderer | WebGL2 compositor, ping-pong FBOs, multi-pass effect chain, keyframe interpolation |
| Effects | Brightness, Gaussian blur, vignette, background removal — all GLSL ES 3.0 fragment passes |
| Text | Canvas2D-rendered text clips with size/color/bg controls + a dedicated subtitles track |
| Media | OPFS-backed assets, thumbnail/waveform probe, drag-drop ingest |
| AI (all local) | Auto silence cut (WebAudio RMS), Whisper transcription (HuggingFace), Scene detect (χ²), Background removal (MediaPipe Selfie) |
| Export | WebCodecs H.264/VP9/AV1 + AAC audio mixer, four presets (YouTube 1080p/4K, TikTok 9:16, Web VP9) |
| Persistence | Yjs CRDT + IndexedDB — survives reloads, browser restarts |
| Collaboration | y-websocket join/leave by room code, awareness pills in top bar |
| Plugin SDK | `window.cutEditor.registerEffect` + `registerShader`, load-by-URL via `localStorage["cut.plugins"]` |
| Mobile | Reactive shell with drawer panels + two-finger pinch zoom |

## Repo layout

```
apps/web/         Next.js 15 app (editor UI)
packages/core/    Framework-agnostic engine (data model, scheduler, renderer)
docs/             Design notes + plugin SDK
reference/        OpenCut clone for study (gitignored)
```

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Requirements: Node 20+, pnpm 9+.

## Roadmap (post v0.1)

- WebGPU renderer (wgsl shaders, plugin SDK v2)
- Per-clip transforms (translate/rotate/scale) with keyframe UI
- Mask drawing tool + tracking
- Native desktop wrapper (Tauri)
- Mobile native shells (Capacitor)
- Plugin marketplace + sandboxed iframes
