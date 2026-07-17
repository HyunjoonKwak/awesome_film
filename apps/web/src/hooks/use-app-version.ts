"use client";

import { useSyncExternalStore } from "react";

// Product version for display. In the desktop app the Electron preload bridge
// (window.cutDesktop.version — the actually-installed app) wins; in the
// browser/PWA we fall back to the version baked in at build time from
// apps/desktop/package.json. Hydration-safe: the server snapshot is empty,
// so the badge only renders after mount.
const WEB_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

const subscribe = () => () => {};
const getSnapshot = (): string =>
  (window as unknown as { cutDesktop?: { version?: string | null } }).cutDesktop?.version ||
  WEB_VERSION;

export const useAppVersion = (): string => useSyncExternalStore(subscribe, getSnapshot, () => "");
