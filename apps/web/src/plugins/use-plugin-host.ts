"use client";

import { useEffect } from "react";
import { installPluginSdk, subscribeEffects } from "@/effects/plugin-registry";
import { useProjectStore } from "@/stores/project-store";

// Boots the plugin SDK on mount:
//   1. Exposes window.cutEditor.{registerEffect, registerShader, ...}
//   2. Loads any URLs configured in localStorage["cut.plugins"] (JSON array)
//   3. Forces a project-store change tick whenever a plugin (un)registers an
//      effect so the inspector "Add" menu re-renders.
export const usePluginHost = () => {
  useEffect(() => {
    installPluginSdk();
    const offLog = subscribeEffects(() => {
      // Touch the store so subscribers re-render.
      const s = useProjectStore.getState();
      useProjectStore.setState({ project: { ...s.project } });
    });

    const list = readConfiguredPlugins();
    for (const url of list) {
      const s = document.createElement("script");
      s.type = "module";
      s.src = url;
      s.onerror = () => {
        // biome-ignore lint/suspicious/noConsole: Plugin script failures have no richer error channel.
        console.warn("Failed to load plugin:", url);
      };
      document.head.appendChild(s);
    }

    return () => {
      offLog();
    };
  }, []);
};

const readConfiguredPlugins = (): string[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("cut.plugins");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};
