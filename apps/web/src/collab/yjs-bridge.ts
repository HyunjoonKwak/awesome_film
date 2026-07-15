import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import type { Clip, Project } from "@cut/core";
import { useProjectStore } from "@/stores/project-store";
import { useSaveStateStore } from "./save-state-store";
import { useAwarenessStore, type PeerCursor } from "./awareness-store";

// Bridges Zustand `project` state into a Yjs document for persistence + sync.
//
// Clip bodies live in their own Y.Map keyed by clip id, so two people editing
// DIFFERENT clips merge instead of clobbering one shared snapshot (the old
// whole-project last-writer-wins). Project scalars + track structure (clip-id
// lists, no bodies) live in `structure`, written only when the structure
// actually changes — so a clip-body edit on one side never wipes a structure
// change on the other. Concurrent STRUCTURE edits (both add/reorder/delete at
// once) are still last-writer-wins; full structural CRDT is a further step.

const CLIPS = "clips";
const STRUCT = "structure";
const STRUCT_KEY = "v";
const LEGACY_MAP = "project"; // pre-clip-level whole-project snapshot
const LEGACY_KEY = "snapshot";

// Tag for our own writes so the observer can ignore them (otherwise a local
// flush would loadProject() over our state and wipe the undo history).
const LOCAL_ORIGIN = { local: true };

// Project shape with clip bodies replaced by id lists — what `structure` holds.
type Structure = Omit<Project, "timeline"> & {
  timeline: Omit<Project["timeline"], "tracks"> & {
    tracks: (Omit<Project["timeline"]["tracks"][number], "clips"> & {
      clipIds: readonly string[];
    })[];
  };
};

const toStructure = (p: Project): Structure => ({
  ...p,
  timeline: {
    ...p.timeline,
    tracks: p.timeline.tracks.map(({ clips, ...rest }) => ({
      ...rest,
      clipIds: clips.map((c) => c.id),
    })),
  },
});

const rebuild = (structure: Structure, clipsMap: Y.Map<Clip>): Project =>
  ({
    ...structure,
    timeline: {
      ...structure.timeline,
      tracks: structure.timeline.tracks.map(({ clipIds, ...rest }) => ({
        ...rest,
        clips: clipIds
          .map((id) => clipsMap.get(id))
          .filter((c): c is Clip => c !== undefined),
      })),
    },
  }) as Project;

const clipJsonMap = (p: Project): Map<string, string> =>
  new Map(
    p.timeline.tracks.flatMap((t) => t.clips.map((c) => [c.id, JSON.stringify(c)] as const)),
  );

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
  const clipsMap = doc.getMap<Clip>(CLIPS);
  const structMap = doc.getMap<Structure>(STRUCT);

  let applyingRemote = false;
  // Caches so a flush only writes clips/structure that actually changed —
  // this is what keeps a local edit from clobbering a peer's concurrent edit.
  let lastStructureJson = "";
  let lastClipJson = new Map<string, string>();

  const SNAPSHOT_DEBOUNCE_MS = 120;
  let pending: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    pending = null;
    const project = useProjectStore.getState().project;
    doc.transact(() => {
      const seen = new Set<string>();
      const nextClips = new Map<string, string>();
      for (const track of project.timeline.tracks) {
        for (const clip of track.clips) {
          seen.add(clip.id);
          const json = JSON.stringify(clip);
          nextClips.set(clip.id, json);
          if (lastClipJson.get(clip.id) !== json) {
            clipsMap.set(clip.id, JSON.parse(json) as Clip);
          }
        }
      }
      for (const id of [...clipsMap.keys()]) {
        if (!seen.has(id)) clipsMap.delete(id);
      }
      lastClipJson = nextClips;

      const structureJson = JSON.stringify(toStructure(project));
      if (structureJson !== lastStructureJson) {
        structMap.set(STRUCT_KEY, JSON.parse(structureJson) as Structure);
        lastStructureJson = structureJson;
      }
    }, LOCAL_ORIGIN);
  };

  const unsubscribe = useProjectStore.subscribe(
    (s) => s.project,
    () => {
      if (applyingRemote) return;
      useSaveStateStore.getState().setState("saving");
      if (pending) clearTimeout(pending);
      pending = setTimeout(flush, SNAPSHOT_DEBOUNCE_MS);
    },
  );

  persistence.on("synced", () => useSaveStateStore.getState().markSaved());

  const applyRemote = () => {
    const structure = structMap.get(STRUCT_KEY);
    if (!structure) return;
    applyingRemote = true;
    const project = rebuild(structure, clipsMap);
    // Prime the caches so our next flush doesn't re-broadcast what we received.
    lastStructureJson = JSON.stringify(toStructure(project));
    lastClipJson = clipJsonMap(project);
    useProjectStore.getState().loadProject(project);
    applyingRemote = false;
  };

  const handleRemote = (tx: Y.Transaction) => {
    if (tx.origin === LOCAL_ORIGIN) return; // our own write — ignore
    applyRemote();
  };
  const onClips = (_e: Y.YMapEvent<Clip>, tx: Y.Transaction) => handleRemote(tx);
  const onStruct = (_e: Y.YMapEvent<Structure>, tx: Y.Transaction) => handleRemote(tx);
  clipsMap.observe(onClips);
  structMap.observe(onStruct);

  persistence.whenSynced.then(() => {
    // One-time migration from the pre-clip-level whole-project snapshot so
    // existing local projects keep opening after this change ships.
    const legacy = doc.getMap<Project>(LEGACY_MAP).get(LEGACY_KEY);
    if (legacy && !structMap.get(STRUCT_KEY)) {
      doc.transact(() => {
        for (const track of legacy.timeline.tracks) {
          for (const clip of track.clips) {
            clipsMap.set(clip.id, JSON.parse(JSON.stringify(clip)) as Clip);
          }
        }
        structMap.set(STRUCT_KEY, JSON.parse(JSON.stringify(toStructure(legacy))) as Structure);
        doc.getMap(LEGACY_MAP).delete(LEGACY_KEY);
      }, LOCAL_ORIGIN);
    }
    applyRemote();
  });

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
      // Flush any deferred change so we don't lose the last edit on teardown.
      if (pending) {
        clearTimeout(pending);
        flush();
      }
      clipsMap.unobserve(onClips);
      structMap.unobserve(onStruct);
      persistence.destroy();
      doc.destroy();
      bridge = null;
    },
  };
  return bridge;
};
