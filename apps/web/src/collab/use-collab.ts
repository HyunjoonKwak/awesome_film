"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { getBridge } from "./yjs-bridge";

let started = false;

// Mount once at the editor root. Starts Yjs IDB persistence so the project
// survives page reloads. Realtime peers ship in 7.1 via y-websocket.
export const useCollab = () => {
  useEffect(() => {
    if (started) return;
    started = true;
    try {
      const bridge = getBridge();
      // No noisy toast on every reload — only the first time.
      const seenKey = "cut.collab.welcomed";
      if (!localStorage.getItem(seenKey)) {
        toast.success("Local-first persistence on (IndexedDB)");
        localStorage.setItem(seenKey, "1");
      }
      return () => {
        bridge.dispose();
        started = false;
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Collab bridge failed:", err);
    }
  }, []);
};
