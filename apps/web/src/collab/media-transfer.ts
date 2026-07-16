import type { MediaAsset, Project } from "@cut/core";
import { leaseMediaKey } from "@/persistence/media-gc";
import { createMediaFileWriter, readMediaFile, type MediaFileWriter } from "@/persistence/opfs";
import { useMediaTransferStore } from "./media-transfer-store";

const REQUEST_FIELD = "mediaRequest";
const CHUNK_FIELD = "mediaChunk";
const MEDIA_CHUNK_BYTES = 32 * 1024;
const MAX_TRANSFER_BYTES = 50 * 1024 * 1024 * 1024;
const MAX_ENCODED_CHUNK_LENGTH = Math.ceil(MEDIA_CHUNK_BYTES / 3) * 4 + 4;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

interface MediaRequest {
  readonly version: 1;
  readonly transferId: string;
  readonly assetId: string;
  readonly offset: number;
}

interface MediaChunk {
  readonly version: 1;
  readonly targetClientId: number;
  readonly transferId: string;
  readonly assetId: string;
  readonly offset: number;
  readonly totalBytes: number;
  readonly mimeType: string;
  readonly data: string;
  readonly sha256: string;
  readonly done: boolean;
}

type AwarenessState = Record<string, unknown>;

export interface MediaTransferAwareness {
  readonly clientID: number;
  getStates: () => Map<number, AwarenessState>;
  getLocalState: () => AwarenessState | null;
  setLocalStateField: (field: string, value: unknown) => void;
  on: (event: "change", handler: () => void) => void;
  off: (event: "change", handler: () => void) => void;
}

interface MediaTransferStorage {
  read: (key: string) => Promise<Blob | null>;
  createWriter: (key: string, mimeType: string) => Promise<MediaFileWriter>;
  lease: (key: string) => () => void;
}

interface MediaTransferOptions {
  readonly awareness: MediaTransferAwareness;
  readonly getProject: () => Project;
  readonly storage?: MediaTransferStorage;
  readonly onProgress?: (
    progress: {
      assetId: string;
      name: string;
      receivedBytes: number;
      totalBytes: number;
    } | null,
  ) => void;
  readonly onError?: (message: string | null) => void;
  readonly createTransferId?: () => string;
  readonly requestTimeoutMs?: number;
}

export interface MediaTransferManager {
  scan: () => void;
  dispose: () => void;
}

interface IncomingTransfer {
  readonly transferId: string;
  readonly asset: MediaAsset;
  readonly writer: MediaFileWriter;
  readonly releaseLease: () => void;
  readonly totalBytes: number;
  nextOffset: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSafeOffset = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const isMediaRequest = (value: unknown): value is MediaRequest =>
  isObject(value) &&
  value.version === 1 &&
  typeof value.transferId === "string" &&
  value.transferId.length > 0 &&
  typeof value.assetId === "string" &&
  value.assetId.length > 0 &&
  isSafeOffset(value.offset) &&
  value.offset <= MAX_TRANSFER_BYTES;

export const isMediaChunk = (value: unknown): value is MediaChunk =>
  isObject(value) &&
  value.version === 1 &&
  typeof value.targetClientId === "number" &&
  Number.isSafeInteger(value.targetClientId) &&
  typeof value.transferId === "string" &&
  value.transferId.length > 0 &&
  typeof value.assetId === "string" &&
  value.assetId.length > 0 &&
  isSafeOffset(value.offset) &&
  isSafeOffset(value.totalBytes) &&
  value.totalBytes <= MAX_TRANSFER_BYTES &&
  typeof value.mimeType === "string" &&
  typeof value.data === "string" &&
  value.data.length <= MAX_ENCODED_CHUNK_LENGTH &&
  typeof value.sha256 === "string" &&
  /^[a-f0-9]{64}$/.test(value.sha256) &&
  typeof value.done === "boolean";

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const base64ToBytes = (encoded: string): Uint8Array => {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error("SHA-256 is unavailable in this browser");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isSafeMediaKey = (key: string): boolean =>
  key.length > 0 &&
  key.length <= 240 &&
  key !== "." &&
  key !== ".." &&
  !key.includes("/") &&
  !key.includes("\\");

const defaultStorage: MediaTransferStorage = {
  read: readMediaFile,
  createWriter: createMediaFileWriter,
  lease: leaseMediaKey,
};

const defaultTransferId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// Transfers only ephemeral chunks through Awareness. The Y.Doc contains media
// metadata, but never the binary payload, so CRDT history remains compact.
export const createMediaTransferManager = ({
  awareness,
  getProject,
  storage = defaultStorage,
  onProgress = (progress) => useMediaTransferStore.getState().setProgress(progress),
  onError = (message) => useMediaTransferStore.getState().setError(message),
  createTransferId = defaultTransferId,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: MediaTransferOptions): MediaTransferManager => {
  let disposed = false;
  let scanning = false;
  let scanAgain = false;
  let receiving = false;
  let restarting = false;
  let serving = false;
  let incoming: IncomingTransfer | null = null;
  let failedAssetId: string | null = null;
  let requestTimer: ReturnType<typeof setTimeout> | null = null;

  const localRequest = (): MediaRequest | null => {
    const value = awareness.getLocalState()?.[REQUEST_FIELD];
    return isMediaRequest(value) ? value : null;
  };

  const findAsset = (assetId: string): MediaAsset | undefined =>
    getProject().mediaLibrary.find((asset) => asset.id === assetId);

  const clearRequestTimer = (): void => {
    if (requestTimer === null) return;
    clearTimeout(requestTimer);
    requestTimer = null;
  };

  const abortIncoming = async (): Promise<void> => {
    const active = incoming;
    incoming = null;
    if (!active) return;
    try {
      await active.writer.abort();
    } catch {
      // Cleanup is best-effort; keep the original transfer error visible.
    } finally {
      active.releaseLease();
    }
  };

  const fail = async (assetId: string, error: unknown): Promise<void> => {
    failedAssetId = assetId;
    clearRequestTimer();
    awareness.setLocalStateField(REQUEST_FIELD, null);
    await abortIncoming();
    onProgress(null);
    onError(error instanceof Error ? error.message : String(error));
  };

  const armRequestTimer = (request: MediaRequest): void => {
    clearRequestTimer();
    requestTimer = setTimeout(
      () => {
        requestTimer = null;
        void restartRequest(request);
      },
      Math.max(1, requestTimeoutMs),
    );
  };

  const restartRequest = async (expired: MediaRequest): Promise<void> => {
    if (disposed || restarting) return;
    const current = localRequest();
    if (
      !current ||
      current.transferId !== expired.transferId ||
      current.assetId !== expired.assetId ||
      current.offset !== expired.offset
    ) {
      return;
    }
    if (receiving) {
      armRequestTimer(current);
      return;
    }
    restarting = true;
    try {
      await abortIncoming();
      if (disposed) return;
      const asset = findAsset(expired.assetId);
      if (!asset || !isSafeMediaKey(asset.opfsPath)) {
        awareness.setLocalStateField(REQUEST_FIELD, null);
        queueMicrotask(() => void scanMissing());
        return;
      }
      const replacement: MediaRequest = {
        version: 1,
        transferId: createTransferId(),
        assetId: asset.id,
        offset: 0,
      };
      onProgress({ assetId: asset.id, name: asset.name, receivedBytes: 0, totalBytes: 0 });
      awareness.setLocalStateField(REQUEST_FIELD, replacement);
      armRequestTimer(replacement);
    } finally {
      restarting = false;
    }
  };

  const scanMissing = async (): Promise<void> => {
    if (disposed) return;
    if (scanning) {
      scanAgain = true;
      return;
    }
    if (receiving || incoming || localRequest()) return;
    scanning = true;
    try {
      for (const asset of getProject().mediaLibrary) {
        if (disposed || localRequest()) return;
        if (asset.id === failedAssetId || !isSafeMediaKey(asset.opfsPath)) continue;
        if (await storage.read(asset.opfsPath)) continue;
        const currentAsset = findAsset(asset.id);
        if (!currentAsset || currentAsset.opfsPath !== asset.opfsPath) continue;
        const request: MediaRequest = {
          version: 1,
          transferId: createTransferId(),
          assetId: asset.id,
          offset: 0,
        };
        onError(null);
        onProgress({ assetId: asset.id, name: asset.name, receivedBytes: 0, totalBytes: 0 });
        awareness.setLocalStateField(REQUEST_FIELD, request);
        armRequestTimer(request);
        return;
      }
      onProgress(null);
    } finally {
      scanning = false;
      if (scanAgain) {
        scanAgain = false;
        queueMicrotask(() => void scanMissing());
      }
    }
  };

  const receiveChunk = async (): Promise<void> => {
    if (disposed || receiving || restarting) return;
    const request = localRequest();
    if (!request) return;
    const candidate = [...awareness.getStates().entries()]
      .filter(([clientId]) => clientId !== awareness.clientID)
      .map(([, state]) => state[CHUNK_FIELD])
      .find(
        (value): value is MediaChunk =>
          isMediaChunk(value) &&
          value.targetClientId === awareness.clientID &&
          value.transferId === request.transferId &&
          value.assetId === request.assetId &&
          value.offset === request.offset,
      );
    if (!candidate) return;

    receiving = true;
    clearRequestTimer();
    try {
      const asset = findAsset(request.assetId);
      if (!asset || !isSafeMediaKey(asset.opfsPath)) {
        await fail(request.assetId, new Error("Remote media metadata is no longer available"));
        return;
      }
      const bytes = base64ToBytes(candidate.data);
      if ((await sha256Hex(bytes)) !== candidate.sha256) {
        throw new Error("Remote media chunk failed its SHA-256 integrity check");
      }
      const nextOffset = candidate.offset + bytes.byteLength;
      if (
        bytes.byteLength > MEDIA_CHUNK_BYTES ||
        candidate.totalBytes < nextOffset ||
        candidate.done !== (nextOffset === candidate.totalBytes) ||
        (!candidate.done && bytes.byteLength === 0)
      ) {
        armRequestTimer(request);
        return;
      }

      if (!incoming) {
        if (candidate.offset !== 0) {
          armRequestTimer(request);
          return;
        }
        const releaseLease = storage.lease(asset.opfsPath);
        try {
          incoming = {
            transferId: request.transferId,
            asset,
            writer: await storage.createWriter(asset.opfsPath, candidate.mimeType || asset.mime),
            releaseLease,
            totalBytes: candidate.totalBytes,
            nextOffset: 0,
          };
        } catch (error) {
          releaseLease();
          throw error;
        }
      }
      if (
        incoming.transferId !== request.transferId ||
        incoming.asset.id !== request.assetId ||
        incoming.nextOffset !== candidate.offset ||
        incoming.totalBytes !== candidate.totalBytes
      ) {
        armRequestTimer(request);
        return;
      }

      await incoming.writer.write(candidate.offset, bytes);
      incoming.nextOffset = nextOffset;
      onProgress({
        assetId: asset.id,
        name: asset.name,
        receivedBytes: nextOffset,
        totalBytes: candidate.totalBytes,
      });

      if (candidate.done) {
        const completed = incoming;
        await completed.writer.close();
        incoming = null;
        completed.releaseLease();
        clearRequestTimer();
        awareness.setLocalStateField(REQUEST_FIELD, null);
        onProgress(null);
        queueMicrotask(() => void scanMissing());
      } else {
        const nextRequest = { ...request, offset: nextOffset };
        awareness.setLocalStateField(REQUEST_FIELD, nextRequest);
        armRequestTimer(nextRequest);
      }
    } catch (error) {
      await fail(request.assetId, error);
    } finally {
      receiving = false;
    }
  };

  const serveRequest = async (): Promise<void> => {
    if (disposed || serving) return;
    const requests = [...awareness.getStates().entries()]
      .filter(([clientId]) => clientId !== awareness.clientID)
      .map(([clientId, state]) => ({ clientId, request: state[REQUEST_FIELD] }))
      .filter((entry): entry is { clientId: number; request: MediaRequest } =>
        isMediaRequest(entry.request),
      )
      .sort((left, right) => left.clientId - right.clientId);
    if (requests.length === 0) {
      if (awareness.getLocalState()?.[CHUNK_FIELD]) {
        awareness.setLocalStateField(CHUNK_FIELD, null);
      }
      return;
    }
    const published = awareness.getLocalState()?.[CHUNK_FIELD];
    if (isMediaChunk(published)) {
      const awaitingAck = requests.some(
        ({ clientId, request }) =>
          published.targetClientId === clientId &&
          published.transferId === request.transferId &&
          published.offset === request.offset,
      );
      if (awaitingAck) return;
    }

    serving = true;
    try {
      // A peer may not own every requested asset. Skip requests it cannot
      // satisfy so one missing file does not starve the other recipients.
      for (const active of requests) {
        const asset = findAsset(active.request.assetId);
        if (!asset || !isSafeMediaKey(asset.opfsPath)) continue;
        const blob = await storage.read(asset.opfsPath);
        if (!blob || active.request.offset > blob.size || blob.size > MAX_TRANSFER_BYTES) continue;
        const current = awareness.getStates().get(active.clientId)?.[REQUEST_FIELD];
        if (
          disposed ||
          !isMediaRequest(current) ||
          current.transferId !== active.request.transferId ||
          current.offset !== active.request.offset
        ) {
          continue;
        }
        const end = Math.min(blob.size, active.request.offset + MEDIA_CHUNK_BYTES);
        const bytes = new Uint8Array(await blob.slice(active.request.offset, end).arrayBuffer());
        const chunk: MediaChunk = {
          version: 1,
          targetClientId: active.clientId,
          transferId: active.request.transferId,
          assetId: active.request.assetId,
          offset: active.request.offset,
          totalBytes: blob.size,
          mimeType: blob.type || asset.mime,
          data: bytesToBase64(bytes),
          sha256: await sha256Hex(bytes),
          done: end === blob.size,
        };
        awareness.setLocalStateField(CHUNK_FIELD, chunk);
        return;
      }
    } finally {
      serving = false;
    }
  };

  const awarenessChanged = (): void => {
    void receiveChunk();
    void serveRequest();
    void scanMissing();
  };

  awareness.on("change", awarenessChanged);
  queueMicrotask(() => void scanMissing());

  return {
    scan: () => {
      if (failedAssetId && !findAsset(failedAssetId)) failedAssetId = null;
      const request = localRequest();
      const requestedAsset = request ? findAsset(request.assetId) : null;
      if (
        request &&
        (!requestedAsset ||
          (incoming !== null && incoming.asset.opfsPath !== requestedAsset.opfsPath))
      ) {
        clearRequestTimer();
        awareness.setLocalStateField(REQUEST_FIELD, null);
        void abortIncoming().then(() => scanMissing());
        return;
      }
      void scanMissing();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearRequestTimer();
      awareness.off("change", awarenessChanged);
      awareness.setLocalStateField(REQUEST_FIELD, null);
      awareness.setLocalStateField(CHUNK_FIELD, null);
      void abortIncoming();
      onProgress(null);
    },
  };
};
