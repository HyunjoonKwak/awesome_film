import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import type { Project } from "@cut/core";
import { useProjectStore } from "@/stores/project-store";
import { useSaveStateStore } from "./save-state-store";
import { useAwarenessStore, type PeerCursor } from "./awareness-store";

// Bridges Zustand `project` state into a Yjs document so we can layer
// persistence, cross-session history, and realtime sync without touching
// UI code. Snapshot-keyed Y.Map is good enough today; finer-grained CRDT
// mapping is an optimisation, not a correctness change.

const DOC_KEY = "snapshot";

export interface CollabBridge {
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  ws: WebsocketProvider | null;
  joinRoom: (server: string, room: string) => void;
  leaveRoom: () => void;
  dispose: () => void;
}

let bridge: CollabBridge | null = null;

export const getBridge = (): CollabBridge => {
  if (bridge) return bridge;
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence("cut-editor:project", doc);
  const map = doc.getMap<Project>("project");

  let applyingRemote = false;

  // Debounce snapshot writes so slider drags / keyboard nudges don't fire a
  // full transact + JSON snapshot on every micro-change. Save-state flips to
  // "saving" immediately so the UI reflects pending changes.
  const SNAPSHOT_DEBOUNCE_MS = 120;
  let pendingSnapshot: ReturnType<typeof setTimeout> | null = null;
  const flushSnapshot = () => {
    pendingSnapshot = null;
    const project = useProjectStore.getState().project;
    doc.transact(() => {
      map.set(DOC_KEY, JSON.parse(JSON.stringify(project)) as Project);
    });
  };
  const unsubscribe = useProjectStore.subscribe(
    (s) => s.project,
    () => {
      if (applyingRemote) return;
      useSaveStateStore.getState().setState("saving");
      if (pendingSnapshot) clearTimeout(pendingSnapshot);
      pendingSnapshot = setTimeout(flushSnapshot, SNAPSHOT_DEBOUNCE_MS);
    },
  );

  persistence.on("synced", () => useSaveStateStore.getState().markSaved());

  const observer = () => {
    const snap = map.get(DOC_KEY);
    if (!snap) return;
    applyingRemote = true;
    useProjectStore.getState().loadProject(snap as Project);
    applyingRemote = false;
  };
  map.observe(observer);
  persistence.whenSynced.then(() => observer());

  let ws: WebsocketProvider | null = null;
  const peerSync = () => {
    if (!ws) {
      useAwarenessStore.getState().setPeers(new Map());
      return;
    }
    const states = ws.awareness.getStates();
    const peers = new Map<string, PeerCursor>();
    states.forEach((state, clientId) => {
      const idStr = String(clientId);
      if (ws && idStr === String(ws.awareness.clientID)) return;
      const u = state.user as Partial<PeerCursor> | undefined;
      if (!u) return;
      peers.set(idStr, {
        id: idStr,
        name: u.name ?? "anon",
        color: u.color ?? "#888",
        playheadMs: u.playheadMs ?? null,
        selectedClipIds: u.selectedClipIds ?? [],
      });
    });
    useAwarenessStore.getState().setPeers(peers);
  };

  let unsubLocalCursor: (() => void) | null = null;

  const broadcastCursor = () => {
    if (!ws) return;
    const self = useAwarenessStore.getState();
    const proj = useProjectStore.getState().project;
    ws.awareness.setLocalStateField("user", {
      id: self.selfId,
      name: self.selfName,
      color: self.selfColor,
      playheadMs: proj.timeline.playhead,
      selectedClipIds: [] as string[],
    });
  };

  const joinRoom = (server: string, room: string) => {
    if (ws) ws.destroy();
    ws = new WebsocketProvider(server, room, doc);
    broadcastCursor();
    ws.awareness.on("change", peerSync);
    // Re-broadcast our cursor whenever the playhead moves.
    unsubLocalCursor = useProjectStore.subscribe(
      (s) => s.project.timeline.playhead,
      () => broadcastCursor(),
    );
    if (bridge) bridge.ws = ws;
  };
  const leaveRoom = () => {
    if (!ws) return;
    ws.awareness.off("change", peerSync);
    unsubLocalCursor?.();
    unsubLocalCursor = null;
    ws.destroy();
    ws = null;
    if (bridge) bridge.ws = null;
    useAwarenessStore.getState().setPeers(new Map());
  };

  bridge = {
    doc,
    persistence,
    ws,
    joinRoom,
    leaveRoom,
    dispose: () => {
      leaveRoom();
      unsubscribe();
      // Flush any deferred snapshot so we don't lose the last edit on teardown.
      if (pendingSnapshot) {
        clearTimeout(pendingSnapshot);
        flushSnapshot();
      }
      map.unobserve(observer);
      persistence.destroy();
      doc.destroy();
      bridge = null;
    },
  };
  return bridge;
};
