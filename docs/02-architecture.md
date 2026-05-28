# cut_editor — Architecture

## Guiding principles

1. **Domain-first folder layout.** Mirror OpenCut's `src/<domain>/`
   organization. Each domain owns its store + hooks + components.
2. **TypeScript decides "what", GPU decides "how".** Keep effect/composition
   logic data-driven; ship WebGL2 first, swap in WebGPU when stable.
3. **Immutable state.** Zustand + `immer` (or plain spreads). No in-place
   mutation of clips/tracks/effects.
4. **Local-first, cloud-augmented.** IndexedDB + OPFS for projects/media;
   cloud sync is opt-in. CRDT (Yjs) for collaboration so offline edits merge.
5. **Web is the source of truth.** Desktop wraps the web with Tauri later;
   mobile uses Capacitor or React Native bridge. No platform-specific forks.

## High-level subsystems

```
┌─────────────────────────────────────────────────────────────┐
│  UI shell (Next.js App Router, Tailwind, shadcn)            │
├─────────────────┬──────────────────┬────────────────────────┤
│  Editor panels  │  Timeline canvas │  Preview viewport      │
│  (props/inspect)│  (multi-track)   │  (Canvas2D / WebGL)    │
├─────────────────┴──────────────────┴────────────────────────┤
│  Domain stores (Zustand): project, timeline, preview,       │
│  media, effects, selection, commands (undo/redo), export    │
├─────────────────────────────────────────────────────────────┤
│  Services                                                   │
│   • renderer (WebGL2 → WebGPU) — composite frames           │
│   • playback engine — frame scheduler, A/V sync             │
│   • media pipeline — WebCodecs decode, thumbnail/waveform   │
│   • ai pipeline — Whisper, MediaPipe, scene detect          │
│   • export — FFmpeg.wasm or WebCodecs encoder               │
│   • collab — Yjs awareness + persistence                    │
├─────────────────────────────────────────────────────────────┤
│  Persistence: IndexedDB (Dexie) for project/state,          │
│                OPFS for media blobs, optional cloud sync    │
└─────────────────────────────────────────────────────────────┘
```

## Folder layout (target)

```
cut_editor/
├── docs/                       # design notes (this folder)
├── reference/                  # OpenCut clone for study (gitignored)
├── apps/
│   └── web/                    # Next.js 15 app
│       ├── public/
│       └── src/
│           ├── app/            # App Router (routes, layouts)
│           ├── components/     # shared primitives (shadcn-style)
│           ├── editor/         # editor shell, panel orchestration
│           ├── timeline/       # tracks, clips, snapping, ripple
│           ├── preview/        # viewport, playback controls
│           ├── media/          # ingest, thumbnails, waveforms
│           ├── effects/        # effect registry + definitions
│           ├── transitions/    # transition catalog
│           ├── ai/             # transcription, scene, bgrm, smartcut
│           ├── export/         # render pipeline, codec choice
│           ├── collab/         # Yjs provider, awareness
│           ├── persistence/    # Dexie + OPFS helpers
│           ├── commands/       # undo/redo, command pattern
│           ├── selection/      # multi-select, lasso
│           ├── stores/         # cross-domain Zustand stores
│           ├── lib/            # pure utils (time, math, color)
│           └── types/          # shared TS types
├── packages/
│   ├── core/                   # framework-agnostic engine
│   │   └── src/                # data model, scheduler, renderer
│   ├── ui/                     # shared headless components (later)
│   └── wasm/                   # placeholder for Rust/WASM (future)
├── package.json                # workspaces root
├── pnpm-workspace.yaml         # or bun workspaces
└── tsconfig.base.json
```

We start with `apps/web` + `packages/core`. Other packages added when they
have at least one consumer.

## Tech choices (initial)

- **Runtime**: Node 20+, pnpm (simpler than Bun on CI, ubiquitous tooling)
- **Framework**: Next.js 15 (App Router), React 19, TypeScript 5.6+
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **State**: Zustand 5 + immer middleware
- **DB (local)**: Dexie 4 (IndexedDB), OPFS for binary blobs
- **Media**: `mediabunny` (WebCodecs muxer/demuxer), `wavesurfer.js`
- **Export**: `@ffmpeg/ffmpeg` (WASM) initially; WebCodecs encoder when
  output codec/container supports it natively
- **AI**:
  - `@huggingface/transformers` for Whisper (multi-lang transcription)
  - `@mediapipe/tasks-vision` for selfie segmentation / background removal
  - Custom WASM for shot/scene detection (later)
- **Collab**: `yjs` + `y-indexeddb` + `y-websocket` (self-hosted Hocuspocus)
- **Testing**: Vitest (unit), Playwright (e2e), Storybook (component review)
- **Lint/format**: Biome (single tool, fast)

## Data model (initial sketch)

```ts
type ID = string; // nanoid

interface Project {
  id: ID;
  name: string;
  createdAt: number;
  updatedAt: number;
  framerate: number;       // e.g. 30, 60
  resolution: { w: number; h: number };
  duration: number;        // ms
  timeline: Timeline;
  mediaLibrary: MediaAsset[];
}

interface Timeline {
  tracks: Track[];
  playhead: number;        // ms
  zoom: number;            // px per ms
  magnetic: boolean;       // FCP-style ripple by default?
}

interface Track {
  id: ID;
  kind: "video" | "audio" | "text" | "overlay";
  height: number;
  muted: boolean;
  locked: boolean;
  solo: boolean;
  clips: Clip[];
}

interface Clip {
  id: ID;
  assetId: ID | null;        // null for text/effect-only clips
  start: number;             // timeline ms
  duration: number;          // ms
  trimIn: number;            // source-relative ms
  trimOut: number;
  speed: number;             // 1.0 = normal
  effects: EffectInstance[];
  transitionIn?: Transition;
  transitionOut?: Transition;
  keyframes: KeyframeTrack[];
}

interface EffectInstance {
  id: ID;
  type: string;              // matches EffectDefinition.type
  params: Record<string, number | string | boolean>;
}

interface MediaAsset {
  id: ID;
  name: string;
  kind: "video" | "audio" | "image";
  mime: string;
  durationMs: number;
  width?: number;
  height?: number;
  opfsPath: string;          // OPFS handle key
  thumbUrl?: string;         // object URL or data URL
  waveform?: Float32Array;   // peak data
}
```

All mutations go through the `commands/` layer so undo/redo and collab
broadcast happen for free.

## Rendering pipeline

1. **Schedule**: playback engine asks for frame at time `t`.
2. **Resolve**: timeline store returns visible clips at `t` (ordered by track).
3. **Decode**: media pipeline ensures the relevant `VideoFrame` is decoded
   (LRU cache around `mediabunny` decoder).
4. **Composite**: renderer draws frames bottom-up to an offscreen canvas,
   applying each clip's effect chain (WebGL fragment passes).
5. **Present**: composited canvas blits to the preview viewport.

Effects are pure functions over uniforms — same model as OpenCut, so an
effect definition is portable between TS and (later) Rust shaders.

## Phasing

- **Phase 0 (this session)**: scaffold, shared types, empty stores, dev
  server boot, project-list landing page.
- **Phase 1**: media import → IndexedDB/OPFS → thumbnail/waveform; load a
  single clip into a single-track timeline; play with `<video>` element.
- **Phase 2**: multi-track timeline UI, drag/drop, trim, split.
- **Phase 3**: WebGL compositor + frame-accurate preview.
- **Phase 4**: effects registry + first three effects (brightness, blur,
  vignette) using WebGL passes.
- **Phase 5**: export via FFmpeg.wasm.
- **Phase 6**: AI features — Whisper subtitles → silence removal → bg
  remove → scene detect.
- **Phase 7**: collab + cloud sync.

Each phase is shippable independently.
