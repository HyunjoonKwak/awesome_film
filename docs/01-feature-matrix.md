# Feature Matrix: cut_editor vs OpenCut vs CapCut vs Final Cut Pro

Legend: ✅ shipped • 🟡 partial • ❌ missing • ⭐ our differentiator

## Editing core

| Capability                       | OpenCut | CapCut | FCP | cut_editor target |
| -------------------------------- | :-----: | :----: | :-: | :---------------: |
| Multi-track timeline             |   ✅    |   ✅   | ✅  |        ✅         |
| Magnetic timeline (FCP style)    |   🟡    |   ❌   | ✅  |        ✅         |
| Ripple / roll / slip / slide     |   🟡    |   🟡   | ✅  |        ✅         |
| Compound clips / nesting         |   ❌    |   🟡   | ✅  |        ✅         |
| Frame-accurate scrub             |   ✅    |   ✅   | ✅  |        ✅         |
| Keyframe animation               |   ✅    |   ✅   | ✅  |        ✅         |
| Color grading (scopes, curves)   |   🟡    |   🟡   | ✅  |     ✅ + LUTs     |
| Speed ramps + pitch preservation |   ✅    |   ✅   | ✅  |        ✅         |
| Time remapping                   |   ✅    |   🟡   | ✅  |        ✅         |
| Multicam editing                 |   ❌    |   ❌   | ✅  |     ✅ ⭐ web      |

## Effects & graphics

| Capability                  | OpenCut | CapCut | FCP | cut_editor target |
| --------------------------- | :-----: | :----: | :-: | :---------------: |
| GPU-accelerated effects     |   ✅    |   ✅   | ✅  |        ✅         |
| Mask / shape masks          |   ✅    |   ✅   | ✅  |        ✅         |
| Text + animated text        |   ✅    |   ✅   | ✅  |        ✅         |
| Stickers / overlays         |   ✅    |   ✅   | 🟡  |        ✅         |
| Transitions library         |   ✅    |   ✅   | ✅  |        ✅         |
| User plugin/SDK for effects |   ❌    |   ❌   | ✅  |       ⭐ ✅        |

## AI features (our biggest opportunity)

| Capability                       | OpenCut | CapCut | FCP | cut_editor target |
| -------------------------------- | :-----: | :----: | :-: | :---------------: |
| Auto subtitles (local)           |   ✅    |   ✅   | 🟡  |  ✅ Whisper WASM  |
| Multilingual translation         |   🟡    |   ✅   | ❌  |        ✅         |
| Auto silence removal             |   ❌    |   ✅   | ❌  |       ⭐ ✅        |
| Scene / shot detection           |   ❌    |   ✅   | 🟡  |       ⭐ ✅        |
| Auto color match across clips    |   ❌    |   🟡   | ✅  |       ⭐ ✅        |
| Background removal (no greenscr) |   ❌    |   ✅   | 🟡  | ⭐ ✅ MediaPipe   |
| Voice / vocal stem isolation     |   🟡    |   ✅   | 🟡  |       ⭐ ✅        |
| Motion tracking                  |   ❌    |   ✅   | ✅  |        ✅         |
| Smart reframe (vertical / 9:16)  |   ❌    |   ✅   | ❌  |       ⭐ ✅        |
| Auto B-roll suggest              |   ❌    |   🟡   | ❌  |       ⭐ ✅        |

## Collaboration & ops

| Capability                       | OpenCut | CapCut | FCP | cut_editor target |
| -------------------------------- | :-----: | :----: | :-: | :---------------: |
| Realtime multi-user co-edit      |   ❌    |   🟡   | ❌  |  ⭐ ✅ CRDT/Yjs   |
| Comment threads on timeline      |   ❌    |   🟡   | ❌  |       ⭐ ✅        |
| Project version history          |   🟡    |   ✅   | ✅  | ⭐ ✅ git-style   |
| Cloud sync of projects + media   |   ✅    |   ✅   | 🟡  |        ✅         |
| Offline-first / PWA              |   🟡    |   ❌   | n/a |       ⭐ ✅        |
| Mobile-native gestures           |   ❌    |   ✅   | n/a |       ⭐ ✅        |
| Export presets (TikTok/YT/Reels) |   🟡    |   ✅   | 🟡  |        ✅         |

## Platform reach

| Capability                | OpenCut | CapCut | FCP | cut_editor target |
| ------------------------- | :-----: | :----: | :-: | :---------------: |
| Web                       |   ✅    |   ✅   | ❌  |        ✅         |
| Desktop (Win/Mac/Linux)   |   🟡    |   ✅   | 🟡  |        ✅         |
| Mobile (iOS/Android)      |   🟡    |   ✅   | ❌  |        ✅         |
| Open source / self-hosted |   ✅    |   ❌   | ❌  |        ✅         |
| Free for all features     |   ✅    |   🟡   | ❌  |        ✅         |

## Our north-star bet

Beat FCP/CapCut on the four axes neither can compete on simultaneously:

1. **Open & free** like OpenCut
2. **AI-native** like CapCut (and beyond)
3. **Collaborative** like Figma — no competitor does this for video well
4. **Web/mobile-first** with progressive desktop power
