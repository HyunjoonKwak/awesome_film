import { createEmptyProject, type ID, type MediaAsset, type Project } from "@cut/core";
import { describe, expect, it } from "vitest";
import type { MediaFileWriter } from "@/persistence/opfs";
import {
  base64ToBytes,
  bytesToBase64,
  createMediaTransferManager,
  isMediaChunk,
  isMediaRequest,
  type MediaTransferAwareness,
} from "../media-transfer";

class AwarenessBus {
  readonly states = new Map<number, Record<string, unknown>>();
  readonly clients = new Set<FakeAwareness>();
  mutate: ((clientId: number, field: string, value: unknown) => unknown) | null = null;

  publish(client: FakeAwareness, field: string, value: unknown): void {
    const published = this.mutate?.(client.clientID, field, value) ?? value;
    this.states.set(client.clientID, {
      ...this.states.get(client.clientID),
      [field]: published,
    });
    for (const peer of this.clients) peer.notify();
  }
}

class FakeAwareness implements MediaTransferAwareness {
  private readonly handlers = new Set<() => void>();

  constructor(
    readonly clientID: number,
    private readonly bus: AwarenessBus,
  ) {
    bus.clients.add(this);
    bus.states.set(clientID, {});
  }

  getStates(): Map<number, Record<string, unknown>> {
    return this.bus.states;
  }

  getLocalState(): Record<string, unknown> {
    return this.bus.states.get(this.clientID) ?? {};
  }

  setLocalStateField(field: string, value: unknown): void {
    this.bus.publish(this, field, value);
  }

  on(_event: "change", handler: () => void): void {
    this.handlers.add(handler);
  }

  off(_event: "change", handler: () => void): void {
    this.handlers.delete(handler);
  }

  notify(): void {
    for (const handler of this.handlers) handler();
  }
}

const asset: MediaAsset = {
  id: "asset-1" as ID,
  name: "remote.mp4",
  kind: "video",
  mime: "video/mp4",
  durationMs: 1000,
  opfsPath: "asset-1.mp4",
  importedAt: 1,
};

const project: Project = createEmptyProject({ mediaLibrary: [asset] });

const mapStorage = (files: Map<string, Blob>) => ({
  read: async (key: string) => files.get(key) ?? null,
  createWriter: async (key: string, mimeType: string): Promise<MediaFileWriter> => {
    const chunks: ArrayBuffer[] = [];
    let offset = 0;
    return {
      write: async (position, data) => {
        if (position !== offset) throw new Error("out of order");
        const copy = Uint8Array.from(data);
        chunks.push(copy.buffer);
        offset += copy.byteLength;
      },
      close: async () => {
        files.set(key, new Blob(chunks, { type: mimeType }));
      },
      abort: async () => {
        files.delete(key);
      },
    };
  },
  lease: () => () => {},
});

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("Timed out waiting for media transfer");
};

describe("media transfer protocol", () => {
  it("round-trips arbitrary binary data through Awareness-safe base64", () => {
    const bytes = Uint8Array.from({ length: 1024 }, (_, index) => index % 251);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("rejects malformed requests and oversized chunks", () => {
    expect(isMediaRequest({ version: 1, transferId: "t", assetId: "a", offset: 0 })).toBe(true);
    expect(isMediaRequest({ version: 1, transferId: "t", assetId: "a", offset: -1 })).toBe(false);
    expect(
      isMediaChunk({
        version: 1,
        targetClientId: 2,
        transferId: "t",
        assetId: "a",
        offset: 0,
        totalBytes: Number.MAX_SAFE_INTEGER,
        mimeType: "video/mp4",
        data: "",
        done: true,
      }),
    ).toBe(false);
  });

  it("streams a multi-chunk asset from one peer into the other peer's store", async () => {
    const sourceBytes = Uint8Array.from({ length: 70_000 }, (_, index) => (index * 17) % 256);
    const sourceFiles = new Map<string, Blob>([
      [asset.opfsPath, new Blob([sourceBytes.buffer], { type: asset.mime })],
    ]);
    const targetFiles = new Map<string, Blob>();
    const bus = new AwarenessBus();
    const sourceAwareness = new FakeAwareness(1, bus);
    const targetAwareness = new FakeAwareness(2, bus);
    const source = createMediaTransferManager({
      awareness: sourceAwareness,
      getProject: () => project,
      storage: mapStorage(sourceFiles),
      onProgress: () => {},
      onError: () => {},
      createTransferId: () => "transfer-1",
    });
    const target = createMediaTransferManager({
      awareness: targetAwareness,
      getProject: () => project,
      storage: mapStorage(targetFiles),
      onProgress: () => {},
      onError: () => {},
      createTransferId: () => "transfer-1",
    });

    await waitFor(() => targetFiles.has(asset.opfsPath));
    const received = targetFiles.get(asset.opfsPath);
    expect(received?.type).toBe(asset.mime);
    if (!received) throw new Error("Transferred file is missing");
    expect(new Uint8Array(await received.arrayBuffer())).toEqual(sourceBytes);

    source.dispose();
    target.dispose();
  });

  it("reissues an unanswered request instead of waiting forever", async () => {
    const bus = new AwarenessBus();
    const awareness = new FakeAwareness(1, bus);
    let sequence = 0;
    const manager = createMediaTransferManager({
      awareness,
      getProject: () => project,
      storage: mapStorage(new Map()),
      onProgress: () => {},
      onError: () => {},
      createTransferId: () => `transfer-${++sequence}`,
      requestTimeoutMs: 5,
    });

    await waitFor(() => isMediaRequest(awareness.getLocalState().mediaRequest));
    const first = awareness.getLocalState().mediaRequest;
    expect(isMediaRequest(first)).toBe(true);
    if (!isMediaRequest(first)) throw new Error("Initial media request is missing");
    await waitFor(() => {
      const current = awareness.getLocalState().mediaRequest;
      return isMediaRequest(current) && current.transferId !== first.transferId;
    });

    manager.dispose();
  });

  it("cancels a pending request when its asset is removed", async () => {
    const bus = new AwarenessBus();
    const awareness = new FakeAwareness(1, bus);
    let currentProject = project;
    const manager = createMediaTransferManager({
      awareness,
      getProject: () => currentProject,
      storage: mapStorage(new Map()),
      onProgress: () => {},
      onError: () => {},
      requestTimeoutMs: 100,
    });

    await waitFor(() => isMediaRequest(awareness.getLocalState().mediaRequest));
    currentProject = { ...project, mediaLibrary: [] };
    manager.scan();
    await waitFor(() => awareness.getLocalState().mediaRequest === null);

    manager.dispose();
  });

  it("rejects a chunk whose bytes do not match its SHA-256 digest", async () => {
    const sourceFiles = new Map<string, Blob>([
      [asset.opfsPath, new Blob([new Uint8Array([1, 2, 3]).buffer], { type: asset.mime })],
    ]);
    const targetFiles = new Map<string, Blob>();
    const bus = new AwarenessBus();
    bus.mutate = (clientId, field, value) => {
      if (clientId !== 1 || field !== "mediaChunk" || !isMediaChunk(value)) return value;
      return { ...value, data: bytesToBase64(new Uint8Array([9, 2, 3])) };
    };
    const sourceAwareness = new FakeAwareness(1, bus);
    const targetAwareness = new FakeAwareness(2, bus);
    let error: string | null = null;
    const source = createMediaTransferManager({
      awareness: sourceAwareness,
      getProject: () => project,
      storage: mapStorage(sourceFiles),
      onProgress: () => {},
      onError: () => {},
    });
    const target = createMediaTransferManager({
      awareness: targetAwareness,
      getProject: () => project,
      storage: mapStorage(targetFiles),
      onProgress: () => {},
      onError: (message) => {
        error = message;
      },
    });

    await waitFor(() => error !== null);
    expect(error).toContain("SHA-256");
    expect(targetFiles.has(asset.opfsPath)).toBe(false);

    source.dispose();
    target.dispose();
  });
});
