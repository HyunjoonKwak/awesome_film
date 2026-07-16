"use client";

import {
  registerEffect,
  registerShader,
  subscribeEffects,
  unregisterEffect,
  unregisterShader,
} from "@/effects/plugin-registry";
import { useProjectStore } from "@/stores/project-store";
import { useEffect } from "react";
import {
  MAX_PLUGIN_BYTES,
  MAX_SHADER_BYTES,
  normalizePluginUrl,
  parseSandboxedEffect,
} from "./plugin-sandbox";

interface SandboxMessage {
  readonly source?: string;
  readonly token?: string;
  readonly type?: string;
  readonly id?: unknown;
  readonly sourceCode?: unknown;
  readonly definition?: unknown;
  readonly message?: unknown;
}

interface LoadedPlugin {
  readonly frame: HTMLIFrameElement;
  dispose(): void;
}

export const usePluginHost = () => {
  useEffect(() => {
    const controller = new AbortController();
    const loaded = new Set<LoadedPlugin>();
    const offLog = subscribeEffects(() => {
      const state = useProjectStore.getState();
      useProjectStore.setState({ project: { ...state.project } });
    });

    for (const configuredUrl of readConfiguredPlugins()) {
      void loadSandboxedPlugin(configuredUrl, controller.signal)
        .then((plugin) => {
          if (!plugin || controller.signal.aborted) {
            plugin?.dispose();
            return;
          }
          loaded.add(plugin);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          // biome-ignore lint/suspicious/noConsole: Plugin failures need a developer diagnostic.
          console.warn("Failed to load sandboxed plugin:", configuredUrl, error);
        });
    }

    return () => {
      controller.abort();
      offLog();
      for (const plugin of loaded) plugin.dispose();
      loaded.clear();
    };
  }, []);
};

// Stream-read a response body, aborting if it exceeds `maxBytes`, so a server
// that omits Content-Length (chunked) can't buffer unbounded bytes into memory
// before the size check runs.
const readCappedText = async (response: Response, maxBytes: number): Promise<string> => {
  const body = response.body;
  if (!body) {
    // No readable stream (older engines / test env): fall back with a post-check.
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error("Plugin exceeds the 256 KiB limit");
    }
    return text;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Plugin exceeds the 256 KiB limit");
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already released after cancel — ignore.
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
};

// A sandbox that never signals "ready" (parse error / hang before init) is torn
// down after this window. NOTE: it CANNOT interrupt a synchronous infinite loop
// inside already-running plugin code — an iframe isn't terminable like a Worker
// — so untrusted plugins remain a documented caveat (see docs/03-plugin-sdk.md).
const PLUGIN_INIT_TIMEOUT_MS = 5000;

const loadSandboxedPlugin = async (
  configuredUrl: string,
  signal: AbortSignal,
): Promise<LoadedPlugin | null> => {
  const url = normalizePluginUrl(configuredUrl, window.location.href);
  if (!url) throw new Error("Plugin URL must use HTTPS, except on localhost");
  const response = await fetch(url, {
    credentials: new URL(url).origin === window.location.origin ? "same-origin" : "omit",
    signal,
  });
  if (!response.ok) throw new Error(`Plugin request failed (${response.status})`);
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_PLUGIN_BYTES) throw new Error("Plugin exceeds the 256 KiB limit");
  const code = await readCappedText(response, MAX_PLUGIN_BYTES);

  const token = crypto.randomUUID();
  const namespace = pluginNamespace(url);
  const qualify = (id: string) => `${namespace}:${id}`;
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = `Sandboxed plugin: ${url}`;
  frame.setAttribute("sandbox", "allow-scripts");
  const effectTypes = new Set<string>();
  const shaderIds = new Set<string>();
  let disposed = false;
  let initTimer: ReturnType<typeof setTimeout> | null = null;

  const onMessage = (event: MessageEvent<SandboxMessage>) => {
    if (
      disposed ||
      event.source !== frame.contentWindow ||
      event.data?.source !== "cut-plugin" ||
      event.data.token !== token
    ) {
      return;
    }
    switch (event.data.type) {
      case "ready":
        if (initTimer !== null) {
          clearTimeout(initTimer);
          initTimer = null;
        }
        frame.contentWindow?.postMessage({ source: "cut-host", token, type: "load", code }, "*");
        break;
      case "registerEffect": {
        const parsed = parseSandboxedEffect(event.data.definition);
        if (!parsed) {
          // biome-ignore lint/suspicious/noConsole: Invalid plugin messages need a developer diagnostic.
          console.warn(`Plugin ${url} sent an invalid effect definition`);
          break;
        }
        const definition = {
          ...parsed,
          type: qualify(parsed.type),
          passes: parsed.passes.map((pass) => ({ ...pass, shader: qualify(pass.shader) })),
        };
        effectTypes.add(definition.type);
        registerEffect(definition);
        break;
      }
      case "unregisterEffect":
        if (typeof event.data.id === "string") {
          const id = qualify(event.data.id);
          if (effectTypes.delete(id)) unregisterEffect(id);
        }
        break;
      case "registerShader":
        if (
          typeof event.data.id === "string" &&
          /^[a-zA-Z0-9_-]{1,64}$/.test(event.data.id) &&
          typeof event.data.sourceCode === "string" &&
          new TextEncoder().encode(event.data.sourceCode).byteLength <= MAX_SHADER_BYTES
        ) {
          const id = qualify(event.data.id);
          shaderIds.add(id);
          registerShader(id, event.data.sourceCode);
        }
        break;
      case "unregisterShader":
        if (typeof event.data.id === "string") {
          const id = qualify(event.data.id);
          if (shaderIds.delete(id)) unregisterShader(id);
        }
        break;
      case "error":
        // biome-ignore lint/suspicious/noConsole: Sandboxed runtime errors need a developer diagnostic.
        console.warn(`Plugin ${url} failed:`, event.data.message);
        break;
    }
  };
  window.addEventListener("message", onMessage);
  frame.srcdoc = sandboxBootstrap(token);
  document.body.appendChild(frame);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (initTimer !== null) {
      clearTimeout(initTimer);
      initTimer = null;
    }
    window.removeEventListener("message", onMessage);
    for (const type of effectTypes) unregisterEffect(type);
    for (const id of shaderIds) unregisterShader(id);
    frame.remove();
  };
  initTimer = setTimeout(() => {
    initTimer = null;
    // biome-ignore lint/suspicious/noConsole: plugin init failures need a developer diagnostic.
    console.warn(`Plugin ${url} did not initialise within ${PLUGIN_INIT_TIMEOUT_MS}ms`);
    dispose();
  }, PLUGIN_INIT_TIMEOUT_MS);
  signal.addEventListener("abort", dispose, { once: true });
  return { frame, dispose };
};

const sandboxBootstrap = (token: string): string => `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; media-src 'none'; style-src 'none'">
<script>
(() => {
  "use strict";
  const token = ${JSON.stringify(token)};
  const send = (type, payload = {}) => parent.postMessage(
    { source: "cut-plugin", token, type, ...payload }, "*"
  );
  const safeSend = (type, payload) => {
    try { send(type, payload); }
    catch (error) { send("error", { message: String(error) }); }
  };
  window.cutEditor = Object.freeze({
    version: 2,
    registerEffect: (definition) => safeSend("registerEffect", { definition }),
    unregisterEffect: (id) => safeSend("unregisterEffect", { id }),
    registerShader: (id, sourceCode) => safeSend("registerShader", { id, sourceCode }),
    unregisterShader: (id) => safeSend("unregisterShader", { id }),
  });
  addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== parent || data?.source !== "cut-host" || data.token !== token) return;
    if (data.type !== "load" || typeof data.code !== "string") return;
    try { (0, eval)(data.code); }
    catch (error) { send("error", { message: error?.stack || String(error) }); }
  });
  send("ready");
})();
</script>`;

const readConfiguredPlugins = (): string[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("cut.plugins");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const pluginNamespace = (url: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `plugin-${(hash >>> 0).toString(16)}`;
};
