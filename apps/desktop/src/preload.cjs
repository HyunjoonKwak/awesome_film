// Preload script. Exposes a small, typed bridge between the Electron main
// process (native menus, save dialog) and the web app's renderer.
//
// The web app stays origin-agnostic: it listens for `cut:export` and
// `cut:snapshot` window events, which the bridge re-dispatches from IPC.

const { contextBridge, ipcRenderer } = require("electron");

const forward = (channel, eventName) => {
  ipcRenderer.on(channel, () => {
    window.dispatchEvent(new CustomEvent(eventName));
  });
};

forward("menu:export", "cut:menu-export");
forward("menu:snapshot", "cut:menu-snapshot");

// The installed app's version, passed by main.cjs via additionalArguments.
const versionArg = process.argv.find((arg) => arg.startsWith("--reelog-version="));

contextBridge.exposeInMainWorld("cutDesktop", {
  // Marker the web app can check to enable desktop-only paths if needed.
  isDesktop: true,
  // App version shown in the web top bar (e.g. "0.2.3").
  version: versionArg ? versionArg.slice("--reelog-version=".length) : null,
  // Native save dialog → returns the chosen file path, or null on cancel.
  // Accepts a Uint8Array of encoded bytes; the main process writes the file.
  saveExport: async (payload) => ipcRenderer.invoke("cut:save-export", payload),
  // YouTube music-credit text for the music library (desktop only — main
  // process fetch has no CORS). Returns parseable text or null.
  fetchMusicCredits: async (url) => ipcRenderer.invoke("cut:fetch-music-credits", url),
});
