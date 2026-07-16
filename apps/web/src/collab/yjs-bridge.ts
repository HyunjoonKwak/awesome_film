import { useProjectStore } from "@/stores/project-store";
import type { Clip, Project } from "@cut/core";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { type PeerCursor, useAwarenessStore } from "./awareness-store";
import { useCollabSessionStore } from "./collab-session-store";
import {
  diffPendingProject,
  mergePendingProject,
  projectClipJson,
  projectStructureFingerprint,
} from "./project-merge";
import { useSaveStateStore } from "./save-state-store";

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
type Structure = Omit<Project, "id" | "timeline"> & {
  timeline: Omit<Project["timeline"], "tracks"> & {
    tracks: (Omit<Project["timeline"]["tracks"][number], "clips"> & {
      clipIds: readonly string[];
    })[];
  };
};

const toStructure = (p: Project): Structure => {
  const { id: _localProjectId, ...project } = p;
  return {
    ...project,
    timeline: {
      ...p.timeline,
      tracks: p.timeline.tracks.map(({ clips, ...rest }) => ({
        ...rest,
        clipIds: clips.map((c) => c.id),
      })),
    },
  };
};

const rebuild = (
  projectId: Project["id"],
  structure: Structure,
  clipsMap: Y.Map<Clip>,
): Project => {
  const project = {
    ...structure,
    // A project id identifies a local library entry, not shared content. Each
    // peer keeps its own id so a remote snapshot cannot trigger a local
    // project switch and tear down the room it just joined.
    id: projectId,
    timeline: {
      ...structure.timeline,
      tracks: structure.timeline.tracks.map(({ clipIds, ...rest }) => ({
        ...rest,
        clips: clipIds.map((id) => clipsMap.get(id)).filter((c): c is Clip => c !== undefined),
      })),
    },
  } as Project;
  const duration = project.timeline.tracks.reduce(
    (max, track) =>
      track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.start + clip.duration), max),
    0,
  );
  return { ...project, timeline: { ...project.timeline, duration } };
};

export interface CollabBridge {
  readonly projectId: Project["id"];
  readonly doc: Y.Doc;
  readonly persistence: IndexeddbPersistence;
  ws: WebsocketProvider | null;
  joinRoom: (server: string, room: string) => void;
  leaveRoom: () => void;
  dispose: () => void;
}

let bridge: CollabBridge | null = null;

export const projectPersistenceName = (projectId: Project["id"]): string =>
  `cut-editor:project:${encodeURIComponent(projectId)}`;

export const getBridge = (): CollabBridge => {
  const projectId = useProjectStore.getState().project.id;
  if (bridge?.projectId === projectId) return bridge;
  bridge?.dispose();
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(projectPersistenceName(projectId), doc);
  const clipsMap = doc.getMap<Clip>(CLIPS);
  const structMap = doc.getMap<Structure>(STRUCT);

  let applyingRemote = false;
  // Caches so a flush only writes clips/structure that actually changed —
  // this is what keeps a local edit from clobbering a peer's concurrent edit.
  let lastStructureFingerprint = "";
  let lastClipJson = new Map<string, string>();

  const SNAPSHOT_DEBOUNCE_MS = 120;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let queuedProject: Project | null =
    useProjectStore.getState().project.id === projectId ? useProjectStore.getState().project : null;
  let disposed = false;

  const flush = () => {
    pending = null;
    const current = useProjectStore.getState().project;
    const project = queuedProject?.id === projectId ? queuedProject : current;
    if (project.id !== projectId || disposed) return;
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

      const structureFingerprint = projectStructureFingerprint(project);
      if (structureFingerprint !== lastStructureFingerprint) {
        structMap.set(STRUCT_KEY, JSON.parse(JSON.stringify(toStructure(project))) as Structure);
        lastStructureFingerprint = structureFingerprint;
      }
    }, LOCAL_ORIGIN);
  };

  const unsubscribe = useProjectStore.subscribe(
    (s) => s.project,
    (project, previous) => {
      if (applyingRemote || project.id !== projectId) return;
      // Playhead and zoom are local view state. Ignoring those high-frequency
      // changes prevents structure LWW churn during playback.
      if (
        project.timeline.tracks === previous.timeline.tracks &&
        project.mediaLibrary === previous.mediaLibrary &&
        project.name === previous.name &&
        project.framerate === previous.framerate &&
        project.resolution === previous.resolution &&
        project.timeline.magnetic === previous.timeline.magnetic &&
        project.timeline.markers === previous.timeline.markers
      ) {
        return;
      }
      useSaveStateStore.getState().setState("saving");
      queuedProject = project;
      if (pending) clearTimeout(pending);
      pending = setTimeout(flush, SNAPSHOT_DEBOUNCE_MS);
    },
  );

  persistence.on("synced", () => useSaveStateStore.getState().markSaved());

  const applyRemote = (): Project | null => {
    const structure = structMap.get(STRUCT_KEY);
    const localProject = useProjectStore.getState().project;
    if (!structure || localProject.id !== projectId || disposed) return null;
    const localView = useProjectStore.getState().project.timeline;
    applyingRemote = true;
    const rebuilt = rebuild(projectId, structure, clipsMap);
    const project: Project = {
      ...rebuilt,
      timeline: {
        ...rebuilt.timeline,
        playhead: localView.playhead,
        zoom: localView.zoom,
      },
    };
    queuedProject = project;
    // Prime the caches so our next flush doesn't re-broadcast what we received.
    lastStructureFingerprint = projectStructureFingerprint(project);
    lastClipJson = projectClipJson(project);
    useProjectStore.getState().loadProject(project);
    applyingRemote = false;
    return project;
  };

  const handleRemote = (tx: Y.Transaction) => {
    if (tx.origin === LOCAL_ORIGIN) return; // our own write — ignore
    const localBeforeRemote = useProjectStore.getState().project;
    const delta = pending
      ? diffPendingProject(localBeforeRemote, lastClipJson, lastStructureFingerprint)
      : null;
    if (pending) {
      clearTimeout(pending);
      pending = null;
    }
    const remote = applyRemote();
    if (!remote || !delta) return;

    const merged = mergePendingProject(remote, delta);
    applyingRemote = true;
    useProjectStore.getState().loadProject(merged);
    applyingRemote = false;
    // Re-emit the preserved local delta immediately. This closes the race where
    // a remote transaction arrived inside the 120ms local debounce window.
    flush();
  };
  const onClips = (_e: Y.YMapEvent<Clip>, tx: Y.Transaction) => handleRemote(tx);
  const onStruct = (_e: Y.YMapEvent<Structure>, tx: Y.Transaction) => handleRemote(tx);
  clipsMap.observe(onClips);
  structMap.observe(onStruct);

  void persistence.whenSynced.then(() => {
    if (disposed) return;
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
    if (structMap.get(STRUCT_KEY)) {
      applyRemote();
    } else {
      // A freshly created per-project document starts with the already
      // hydrated library snapshot instead of waiting for the first edit.
      queuedProject = useProjectStore.getState().project;
      flush();
    }
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
    if (ws) {
      ws.awareness.off("change", peerSync);
      unsubLocalCursor?.();
      unsubLocalCursor = null;
      ws.destroy();
    }
    ws = new WebsocketProvider(server, room, doc);
    broadcastCursor();
    ws.awareness.on("change", peerSync);
    unsubLocalCursor = useProjectStore.subscribe(
      (s) => s.project.timeline.playhead,
      () => broadcastCursor(),
    );
    useCollabSessionStore.getState().setRoom(room);
    if (bridge) bridge.ws = ws;
  };
  const leaveRoom = () => {
    if (ws) {
      ws.awareness.off("change", peerSync);
      unsubLocalCursor?.();
      unsubLocalCursor = null;
      ws.destroy();
      ws = null;
      if (bridge) bridge.ws = null;
    }
    useCollabSessionStore.getState().setRoom(null);
    useAwarenessStore.getState().setPeers(new Map());
  };

  bridge = {
    projectId,
    doc,
    persistence,
    ws,
    joinRoom,
    leaveRoom,
    dispose: () => {
      if (disposed) return;
      leaveRoom();
      unsubscribe();
      // Flush any deferred change so we don't lose the last edit on teardown.
      if (pending) {
        clearTimeout(pending);
        flush();
      }
      disposed = true;
      clipsMap.unobserve(onClips);
      structMap.unobserve(onStruct);
      persistence.destroy();
      doc.destroy();
      bridge = null;
    },
  };
  return bridge;
};

export const disposeBridge = (): void => {
  bridge?.dispose();
};
