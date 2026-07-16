"use client";

import { t } from "@/i18n/use-t";
import { getActiveProjectId, loadStoredProject } from "@/persistence/project-library";
import { useProjectStore } from "@/stores/project-store";
import { useEffect } from "react";
import { toast } from "sonner";
import { useCollabSessionStore } from "./collab-session-store";
import { disposeBridge, getBridge } from "./yjs-bridge";

let started = false;

// Mount once at the editor root. Starts Yjs IDB persistence so the project
// survives page reloads. Realtime peers ship in 7.1 via y-websocket.
export const useCollab = (): boolean => {
  const hydrated = useCollabSessionStore((state) => state.hydrated);

  useEffect(() => {
    if (started) return;
    started = true;
    let cancelled = false;
    let unsubscribeProject: (() => void) | null = null;

    const initialize = async () => {
      try {
        const activeId = await getActiveProjectId();
        const activeResult = activeId ? await loadStoredProject(activeId) : null;
        if (cancelled) return;
        if (activeResult?.status === "ok") {
          useProjectStore.getState().loadProject(activeResult.project);
        } else if (activeResult?.status === "corrupt") {
          toast.error(t("project.activeCorrupt"));
        }

        getBridge();
        unsubscribeProject = useProjectStore.subscribe(
          (state) => state.project.id,
          () => {
            // getBridge disposes the previous project's provider/document and
            // creates the correctly namespaced one for the new active id.
            try {
              getBridge();
            } catch {
              toast.error("Could not open local persistence for this project.");
            }
          },
        );

        // No noisy toast on every reload — only the first time.
        const seenKey = "cut.collab.welcomed";
        if (!localStorage.getItem(seenKey)) {
          toast.success("Local-first persistence on (IndexedDB)");
          localStorage.setItem(seenKey, "1");
        }
      } catch {
        // Persistence failure should not make the editor unusable.
        toast.error("Local project persistence is unavailable for this session.");
      } finally {
        if (!cancelled) useCollabSessionStore.getState().setHydrated(true);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
      unsubscribeProject?.();
      disposeBridge();
      useCollabSessionStore.getState().setHydrated(false);
      started = false;
    };
  }, []);

  return hydrated;
};
