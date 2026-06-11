"use client";

import { useSyncExternalStore } from "react";

// The Electron preload script exposes `window.cutDesktop` (see
// apps/desktop/src/preload.cjs). Hydration-safe: the server snapshot is
// always false, the client snapshot reads the bridge marker.
const subscribe = () => () => {};
const getSnapshot = (): boolean =>
  (window as unknown as { cutDesktop?: { isDesktop?: boolean } }).cutDesktop?.isDesktop === true;

export const useIsDesktopApp = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, () => false);
