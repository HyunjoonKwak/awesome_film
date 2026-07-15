# Honest gap analysis — where we are vs FCP / CapCut / DaVinci Resolve

First written 2026-05 (Phases 1–16). **Re-audited 2026-07** against the actual
code after Phases 17–25 landed: almost everything the May draft marked missing
has since shipped. The tables below reflect the **current** tree, not the
original plan. See git history for the pre-July version.

Legend: ✅ shipped • 🟡 partial / needs work • ❌ missing

## 1. Video output (export)

| Capability | Status | Notes |
| -- | :--: | -- |
| H.264 MP4 export (WebCodecs) | ✅ | 4 presets (YT 1080p/4K, TikTok 9:16, Web VP9) |
| Audio mixing into export | ✅ | OfflineAudioContext + AudioEncoder AAC |
| Clip transform applied (pos/scale/rot) | ✅ | Vertex-shader affine transform, keyframe overrides (`compositor.ts`) |
| Transitions rendered | ✅ | fade/dissolve/dip/slide/zoom/spin + GPU wipe mask |
| Effect keyframe interpolation in export | ✅ | Compositor samples per-frame |
| Export progress + cancel button | ✅ | Progress, fps, ETA, working cancel |
| Loudness normalization | ✅ | LUFS measure + normalize |
| Stereo export | ❌ | Audio mixer hardcodes mono / 48 kHz (`exporter.ts:64`, `audio-mixer.ts`) |
| Lossless / proxy export | ❌ | One quality per preset |
| GIF / image-sequence export | ❌ | |

## 2. Subtitle editing

| Capability | Status | Notes |
| -- | :--: | -- |
| Whisper auto-generation | ✅ | Tiny.en model, source-time mapping |
| Dedicated subtitle panel (list view, batch edit) | ✅ | `subtitles/subtitle-panel.tsx` |
| Edit subtitle text inline | ✅ | Panel list + inspector |
| Adjust subtitle timing | 🟡 | Drag/trim works; no numeric precision input |
| SRT / VTT import | ✅ | `srt.ts` parse round-trip |
| SRT / VTT export | ✅ | Burn-in style presets in panel |
| Per-language tracks | ❌ | |
| Karaoke / word-level styling | ❌ | |

## 3. Effects library

| Capability | Status | Notes |
| -- | :--: | -- |
| GPU-accelerated effect chain | ✅ | WebGL2 ping-pong FBO |
| Built-in effects | ✅ | **24 definitions** — see `effects/definitions/` |
| Color correction (contrast/saturation/hue/levels/LUT) | ✅ | + white-balance, vibrance, split-tone, color-wheels |
| Sharpen / unsharp mask | ✅ | `sharpen.ts` |
| Chroma key (green screen) | ✅ | YUV-distance keyer + spill suppression |
| Stylize (sepia/invert/film grain) | ✅ | `sepia`, `invert`, `grain` |
| Audio effects (EQ/gate/fade/denoise) | ✅ | 5 audio effects incl. FFT spectral denoise |
| Effect reordering | ✅ | Drag-and-drop in `effects-section.tsx` |
| 1D LUT support | ❌ | `parse-cube.ts:29` throws "not supported yet" (3D LUTs work) |
| Effect preview thumbnails | ❌ | |

## 4. GPU performance

| Capability | Status | Notes |
| -- | :--: | -- |
| WebGL2 compositor | ✅ | ~550 lines, ping-pong FBO, 22 shaders |
| WebCodecs VideoDecoder for playback | ✅ | `mp4-decoder.ts` + mp4box demux |
| LRU VideoFrame cache | ✅ | `video-frame-cache.ts` (tested) |
| WebGPU | ❌ | Future; WebGL2 is fine for now |
| Texture pool / explicit GPU memory cap | ❌ | Leaks possible on very long sessions |
| Off-main-thread render (worker) | ❌ | Compositor runs on main; OK for now |
| MediaPipe mask cached per frame | 🟡 | **Still recomputed every render** (`compositor.ts:479`) — heavy |
| Scene-detect / motion-track use WebCodecs decoder | ❌ | Still serial `<video>.currentTime` seeking — slow |

## 5. Component / editing UX

| Capability | Status | Notes |
| -- | :--: | -- |
| Domain folder layout | ✅ | timeline/preview/media/effects/ai/etc |
| Per-clip transform UI | ✅ | `transform-section.tsx` — x/y/scale/rot/opacity + keyframes |
| Effect reorder / category browser | ✅ | Drag reorder + grouped add menu |
| Multi-select (marquee) | ✅ | Cmd/Ctrl+drag in `timeline-panel.tsx` (+ shift-click) |
| Context menus (right-click) | ✅ | Radix `clip-context-menu.tsx` |
| Keyboard nav / shuttle (J/K/L) | ✅ | `use-keyboard-shortcuts.ts` + blade/markers/nudge/group |
| Markers / chapter notes | ✅ | `marker-panel.tsx` + strip + YouTube-chapter export |
| Command palette (Cmd+K) | ✅ | + shortcut cheatsheet |
| **React error boundaries** | ✅ | **Added 2026-07** — route `error.tsx` + preview panel isolation |

## 6. Local file management

| Capability | Status | Notes |
| -- | :--: | -- |
| OPFS-backed media blobs | ✅ | Survives reload, browser restart |
| Yjs project persistence | ✅ | IndexedDB |
| Multi-project library | ✅ | `project-library.ts` + `project-menu.tsx` |
| JSON project export / import | ✅ | `project-export.ts` (now round-trip tested) |
| Media bin search / filter / delete | ✅ | + OPFS storage meter |
| Version snapshots | 🟡 | `snapshots.ts` exists; no named-snapshot UI |
| Media metadata (codec, bitrate, fps) | 🟡 | Only width/height/duration captured |
| Trash / recycle bin | ❌ | Delete is immediate |

## What actually remains — the real backlog (2026-07)

The feature gaps are now mostly **polish**. The load-bearing gaps are in
**engineering health**, not features:

1. **Test coverage ≈ 5.7%.** `core/timeline` and audio DSP are well tested;
   `stores`, `persistence`, `commands/history`, `ai`, and the entire React UI
   are (mostly) untested. Highest-risk untested area: persistence save/load.
   *(2026-07: added round-trip tests for `project-export` and `text-anim`.)*
2. **`packages/core` half-empty.** `ai/collab/export/media/playback/renderer`
   dirs are 0-byte. The real implementations live in `apps/web`, so nothing is
   broken — but the "framework-agnostic engine" goal stalled at model+timeline,
   and the empty dirs are dead scaffolding to either fill or delete.
3. **CI quality gate.** *(2026-07: added `ci.yml` — lint/typecheck/test on
   every push + PR. Previously only a manual release workflow existed.)*
4. **Perf**: MediaPipe mask recompute per frame; AI sampling doesn't reuse the
   WebCodecs decoder; no GPU texture cap.
5. **Feature polish**: stereo export, per-language subtitle tracks, 1D LUTs,
   effect preview thumbnails, named version snapshots, GIF export.

Everything flows through the same immutable command pipeline, so undo/redo and
collaboration stay free as these land.
