import { useProjectStore } from "@/stores/project-store";
import type { Clip, Project, Track } from "@cut/core";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { type PeerCursor, useAwarenessStore } from "./awareness-store";
import { useCollabSessionStore } from "./collab-session-store";
import { createMediaTransferManager, type MediaTransferManager } from "./media-transfer";
import { createProjectCrdt } from "./project-crdt";
import { useSaveStateStore } from "./save-state-store";

// Previous schemas retained only for one-time migration.
const LEGACY_STRUCT = "structure";
const LEGACY_STRUCT_KEY = "v";
const LEGACY_MAP = "project";
const LEGACY_KEY = "snapshot";

const LOCAL_ORIGIN = { local: true };

type TrackMeta = Omit<Track, "clips">;
type LegacyStructure = Omit<Project, "id" | "timeline"> & {
  timeline: Omit<Project["timeline"], "tracks"> & {
    tracks: (TrackMeta & { clipIds: readonly string[] })[];
  };
};

const legacyProject = (
  projectId: Project["id"],
  structure: LegacyStructure,
  clipsMap: Y.Map<Clip>,
  localView: Project["timeline"],
): Project => {
  const tracks = structure.timeline.tracks.map(({ clipIds, ...track }) => ({
    ...track,
    clips: clipIds.map((id) => clipsMap.get(id)).filter((clip): clip is Clip => clip !== undefined),
  }));
  const duration = tracks.reduce(
    (max, track) =>
      track.clips.reduce((trackMax, clip) => Math.max(trackMax, clip.start + clip.duration), max),
    0,
  );
  return {
    ...structure,
    id: projectId,
    timeline: {
      ...structure.timeline,
      tracks,
      duration,
      playhead: localView.playhead,
      zoom: localView.zoom,
    },
  };
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
  const projectCrdt = createProjectCrdt(doc);
  const clipsMap = projectCrdt.clips;

  let applyingRemote = false;
  let disposed = false;
  let mediaTransfer: MediaTransferManager | null = null;

  const flush = (): void => {
    const project = useProjectStore.getState().project;
    if (disposed || project.id !== projectId) return;
    doc.transact(() => projectCrdt.write(project), LOCAL_ORIGIN);
    queueMicrotask(() => useSaveStateStore.getState().markSaved());
  };

  const applyRemote = (): Project | null => {
    if (disposed) return null;
    const localProject = useProjectStore.getState().project;
    if (localProject.id !== projectId) return null;
    const project = projectCrdt.read(projectId, localProject.timeline);
    if (!project) return null;
    applyingRemote = true;
    try {
      useProjectStore.getState().loadProject(project);
      doc.transact(() => projectCrdt.write(project), LOCAL_ORIGIN);
    } finally {
      applyingRemote = false;
    }
    mediaTransfer?.scan();
    return project;
  };

  // Content mutations flush synchronously. Native Yjs operations are cheap,
  // and eliminating the old debounce means no local structural edit exists
  // only in Zustand when a remote transaction arrives.
  const unsubscribe = useProjectStore.subscribe(
    (state) => state.project,
    (project, previous) => {
      if (applyingRemote || project.id !== projectId) return;
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
      flush();
      mediaTransfer?.scan();
    },
  );

  const afterTransaction = (transaction: Y.Transaction) => {
    if (transaction.origin === LOCAL_ORIGIN || disposed) return;
    applyRemote();
  };
  doc.on("afterTransaction", afterTransaction);
  persistence.on("synced", () => useSaveStateStore.getState().markSaved());

  void persistence.whenSynced.then(() => {
    if (disposed) return;
    if (projectCrdt.isInitialized()) {
      applyRemote();
      return;
    }

    const current = useProjectStore.getState().project;
    const oldSnapshot = doc.getMap<Project>(LEGACY_MAP).get(LEGACY_KEY);
    const oldStructure = doc.getMap<LegacyStructure>(LEGACY_STRUCT).get(LEGACY_STRUCT_KEY);
    const seed = oldSnapshot
      ? { ...oldSnapshot, id: projectId }
      : oldStructure
        ? legacyProject(projectId, oldStructure, clipsMap, current.timeline)
        : current;

    doc.transact(() => {
      projectCrdt.write(seed);
      doc.getMap<Project>(LEGACY_MAP).delete(LEGACY_KEY);
      doc.getMap<LegacyStructure>(LEGACY_STRUCT).delete(LEGACY_STRUCT_KEY);
    }, LOCAL_ORIGIN);
    applyRemote();
  });

  let ws: WebsocketProvider | null = null;
  let statusSync:
    | ((event: { status: "connected" | "disconnected" | "connecting" }) => void)
    | null = null;
  const peerSync = () => {
    if (!ws) {
      useAwarenessStore.getState().setPeers(new Map());
      return;
    }
    const states = ws.awareness.getStates();
    const peers = new Map<string, PeerCursor>();
    states.forEach((state, clientId) => {
      const id = String(clientId);
      if (ws && id === String(ws.awareness.clientID)) return;
      const user = state.user as Partial<PeerCursor> | undefined;
      if (!user) return;
      peers.set(id, {
        id,
        name: user.name ?? "anon",
        color: user.color ?? "#888",
        playheadMs: user.playheadMs ?? null,
        selectedClipIds: user.selectedClipIds ?? [],
      });
    });
    useAwarenessStore.getState().setPeers(peers);
  };

  let unsubscribeCursor: (() => void) | null = null;
  const broadcastCursor = () => {
    if (!ws) return;
    const self = useAwarenessStore.getState();
    const project = useProjectStore.getState().project;
    ws.awareness.setLocalStateField("user", {
      id: self.selfId,
      name: self.selfName,
      color: self.selfColor,
      playheadMs: project.timeline.playhead,
      selectedClipIds: [] as string[],
    });
  };

  const destroyProvider = () => {
    if (!ws) return;
    mediaTransfer?.dispose();
    mediaTransfer = null;
    ws.awareness.off("change", peerSync);
    if (statusSync) ws.off("status", statusSync);
    statusSync = null;
    unsubscribeCursor?.();
    unsubscribeCursor = null;
    ws.destroy();
    ws = null;
    if (bridge) bridge.ws = null;
  };

  const joinRoom = (server: string, room: string) => {
    destroyProvider();
    useCollabSessionStore.getState().setConnection(room, "connecting");
    const provider = new WebsocketProvider(server, room, doc);
    ws = provider;
    statusSync = ({ status }) => {
      if (disposed || ws !== provider) return;
      useCollabSessionStore.getState().setStatus(status);
    };
    provider.on("status", statusSync);
    mediaTransfer = createMediaTransferManager({
      awareness: provider.awareness,
      getProject: () => useProjectStore.getState().project,
    });
    broadcastCursor();
    provider.awareness.on("change", peerSync);
    unsubscribeCursor = useProjectStore.subscribe(
      (state) => state.project.timeline.playhead,
      () => broadcastCursor(),
    );
    if (bridge) bridge.ws = ws;
  };

  const leaveRoom = () => {
    destroyProvider();
    useCollabSessionStore.getState().setConnection(null, "disconnected");
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
      disposed = true;
      doc.off("afterTransaction", afterTransaction);
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
