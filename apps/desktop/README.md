# @cut/desktop

**English** · [한국어](README.ko.md)

Electron shell that packages the cut_editor web app as a native macOS
application. The web bundle (Next.js static export from `apps/web`) is
served via a custom `app://` protocol so Service Worker registration and
SharedArrayBuffer (COOP/COEP) keep working inside the desktop window.

## Architecture

```
electron main (src/main.cjs)
 ├─ app:// protocol handler  → serves apps/web/out/** with COOP/COEP headers
 ├─ session header injector  → mirrors COOP/COEP onto http://localhost (dev)
 ├─ BrowserWindow            → loads `app://cut-editor/editor/`
 └─ native menu              → forwards File/Edit/View commands via preload
```

The preload (`src/preload.cjs`) translates IPC messages from native menu
items into `window.dispatchEvent(new CustomEvent("cut:menu-export"))` etc.
The web app can listen for these events to react to native menu clicks.

## Dev workflow

```bash
pnpm --filter @cut/desktop install      # one-time
pnpm --filter @cut/desktop dev          # boots next dev + electron together
```

`dev` launches `pnpm --filter @cut/web dev` and, once `http://localhost:3000/editor`
is reachable, opens an Electron window pointed at it. DevTools open in
a detached pane.

## Packaging a `.dmg`

```bash
pnpm --filter @cut/desktop build:mac          # universal (arm64 + x64)
pnpm --filter @cut/desktop build:mac:arm64    # Apple silicon only
pnpm --filter @cut/desktop build:mac:x64      # Intel only
```

The script:

1. Runs `NEXT_OUTPUT=export next build` in `apps/web/`, producing
   `apps/web/out/` (static HTML + JS + media assets).
2. Invokes `electron-builder --mac` which assembles a `.app` bundle and
   wraps it in a `.dmg`. Output lands in `apps/desktop/dist/`.

The web export inherits the MediaPipe wasm + tflite already vendored
under `apps/web/public/mediapipe/`, so background removal works offline.
For the Whisper transcription model, see the root README — drop the
model under `apps/web/public/whisper/Xenova/whisper-tiny.en/` before
packaging if you want offline-from-first-launch transcription.

## Code signing & notarisation

Hardened runtime is enabled in `electron-builder.yml`. To sign and
notarise, export these env vars before running the build:

```bash
export CSC_LINK=/path/to/DeveloperID.p12
export CSC_KEY_PASSWORD='...'
export APPLE_ID='you@example.com'
export APPLE_APP_SPECIFIC_PASSWORD='abcd-efgh-ijkl-mnop'
export APPLE_TEAM_ID='ABCDE12345'
pnpm --filter @cut/desktop build:mac
```

electron-builder picks these up automatically and runs `notarytool` on the
resulting `.dmg`. Without them you get an unsigned bundle that macOS
Gatekeeper will block — fine for local testing, not for distribution.

## What's next

- Auto-update via `electron-updater` + GitHub Releases (the unsigned
  build already passes `build:mac`; adding the updater is a contained
  follow-up).
- Native file dialogs for export targets (currently the in-app exporter
  uses the browser's download flow).
- Universal Mac App Store build (separate target in electron-builder).
