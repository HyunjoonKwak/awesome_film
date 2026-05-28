"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProxyState {
  // When true, preview/scrub uses proxy media if available. Export always
  // uses originals regardless of this flag.
  useProxy: boolean;
  setUseProxy: (v: boolean) => void;
}

export const useProxyStore = create<ProxyState>()(
  persist(
    (set) => ({
      useProxy: true,
      setUseProxy: (useProxy) => set({ useProxy }),
    }),
    { name: "cut.proxy.v1" },
  ),
);
