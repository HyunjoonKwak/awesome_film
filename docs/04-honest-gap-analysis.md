# Honest gap analysis — where we are vs FCP / CapCut / DaVinci Resolve

Written 2026-05. Phases 1–16 shipped the architecture and the obvious AI
differentiators; this audit catalogues what's still **missing or shallow**
across the six axes the user called out.

Legend: ✅ shipped • 🟡 partial / needs work • ❌ missing

## 1. Video output (export)

| Capability | Status | Notes |
| -- | :--: | -- |
| H.264 MP4 export (WebCodecs) | ✅ | 4 presets (YT 1080p/4K, TikTok 9:16, Web VP9) |
| Audio mixing into export | ✅ | OfflineAudioContext + AudioEncoder AAC |
| Clip transform applied (pos/scale/rot) | ❌ | All clips drawn fullscreen — major gap |
| Transitions rendered | ❌ | Data model exists, never executed |
| Effect keyframe interpolation in export | ✅ | Compositor samples per-frame |
| Export progress + cancel button | 🟡 | Progress yes, cancel button missing |
| Export ETA | ❌ | Just percentage |
| Lossless / proxy export | ❌ | One quality per preset |
| GIF / image-sequence export | ❌ | |

## 2. Subtitle editing

| Capability | Status | Notes |
| -- | :--: | -- |
| Whisper auto-generation | ✅ | Tiny.en model, source-time mapping |
| Edit subtitle text inline | 🟡 | Only via inspector when a single clip is selected |
| Dedicated subtitle panel (list view, batch edit) | ❌ | |
| Adjust subtitle timing | 🟡 | Drag/trim works, no precision input |
| SRT / VTT import | ❌ | |
| SRT / VTT export | ❌ | |
| Per-language tracks | ❌ | |
| Subtitle style presets (top/bottom/karaoke) | ❌ | |

## 3. Effects library

| Capability | Status | Notes |
| -- | :--: | -- |
| GPU-accelerated effect chain | ✅ | WebGL2 ping-pong FBO |
| Built-in effects | 🟡 | 4 only: brightness, blur, vignette, bg-remove |
| Color correction (contrast/saturation/hue/levels/LUT) | ❌ | Critical for any serious editor |
| Sharpen / unsharp mask | ❌ | |
| Chroma key (green screen) | ❌ | Hard requirement for VFX |
| Stylize (sepia/invert/film grain) | ❌ | |
| Audio effects (EQ/compressor/fade) | ❌ | No audio effect chain yet |
| Effect reordering | ❌ | First-added is first-applied; no drag |
| Effect preview thumbnails | ❌ | |
| Per-category browser | 🟡 | `category` field exists on def, no UI |

## 4. GPU performance

| Capability | Status | Notes |
| -- | :--: | -- |
| WebGL2 compositor | ✅ | Custom, ~250 lines |
| WebGPU | ❌ | Future; WebGL2 is fine for now |
| WebCodecs VideoDecoder for playback | ❌ | Big one — currently `<video>.currentTime` seek, slow & imprecise |
| LRU VideoFrame cache | ❌ | |
| Texture pool / explicit GPU memory cap | ❌ | Leaks possible on long sessions |
| Off-main-thread render (worker) | ❌ | Compositor runs on main; OK for now |
| MediaPipe mask cached per frame | 🟡 | Recomputed every render — heavy |

## 5. Component management

| Capability | Status | Notes |
| -- | :--: | -- |
| Domain folder layout | ✅ | timeline/preview/media/effects/ai/etc |
| Per-clip transform UI | ❌ | Position/scale/rotate not editable |
| Effect reorder / collapse | ❌ | |
| Drag-to-add (media → timeline) | 🟡 | Click adds, drag-drop works for files but not for re-positioning |
| Multi-select (rubber band) | ❌ | Only shift-click |
| Context menus (right-click) | ❌ | |
| Keyboard nav between clips (J/K/L) | ❌ | Pro editor staple |
| Markers / chapter notes | ❌ | |
| Bookmarks | ❌ | |

## 6. Local file management

| Capability | Status | Notes |
| -- | :--: | -- |
| OPFS-backed media blobs | ✅ | Survives reload, browser restart |
| Yjs project persistence | ✅ | IndexedDB |
| Media bin search / filter / sort | ❌ | Linear scroll only |
| Delete media | ❌ | No remove button |
| OPFS storage usage indicator | ❌ | |
| Media metadata (codec, bitrate, fps) | 🟡 | Only width/height/duration captured |
| Multi-project library | ❌ | Hardcoded single project |
| JSON project export / import | ❌ | |
| Auto-backup / version history | 🟡 | Yjs gives undo, no named snapshots |
| Trash / recycle bin | ❌ | |

## Priority order for phases 18–25

The biggest practical gaps for a serious editor (in order):

1. **Phase 18 — Effect library expansion** (5 axes blocker)
2. **Phase 19 — Clip transform** (1, 4, 5 axes blocker)
3. **Phase 20 — Subtitle editor + SRT/VTT** (2 axes blocker)
4. **Phase 21 — Media management** (6 axes blocker)
5. **Phase 22 — Multi-project** (6 axes blocker)
6. **Phase 23 — Transitions render** (1, 3 axes blocker)
7. **Phase 24 — WebCodecs VideoDecoder** (4 axes uplift)
8. **Phase 25 — Export hardening** (1 axis polish)

Each phase is shippable independently and all flow through the same
immutable command pipeline so undo/redo and collaboration stay free.
