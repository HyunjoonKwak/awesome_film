// Minimal OPFS file store. Falls back to in-memory blob URLs if OPFS is
// unavailable (Firefox private, older Safari, etc.).

const inMemory = new Map<string, Blob>();
const objectUrls = new Map<string, string>();

const supportsOpfs = () =>
  typeof navigator !== "undefined" && "storage" in navigator && "getDirectory" in navigator.storage;

const getRoot = async (): Promise<FileSystemDirectoryHandle> => {
  return await navigator.storage.getDirectory();
};

export const writeMediaFile = async (key: string, file: File): Promise<string> => {
  if (!supportsOpfs()) {
    inMemory.set(key, file);
    return key;
  }
  const root = await getRoot();
  const handle = await root.getFileHandle(key, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();
  return key;
};

export const readMediaFile = async (key: string): Promise<Blob | null> => {
  if (!supportsOpfs()) return inMemory.get(key) ?? null;
  try {
    const root = await getRoot();
    const handle = await root.getFileHandle(key);
    return await handle.getFile();
  } catch {
    return null;
  }
};

export const getMediaUrl = async (key: string): Promise<string | null> => {
  const cached = objectUrls.get(key);
  if (cached) return cached;
  const blob = await readMediaFile(key);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
};

export const deleteMediaFile = async (key: string): Promise<void> => {
  const url = objectUrls.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(key);
  }
  inMemory.delete(key);
  if (!supportsOpfs()) return;
  try {
    const root = await getRoot();
    await root.removeEntry(key);
  } catch {
    // ignore
  }
};

// Every key currently held in the OPFS store (or the in-memory fallback).
// Used by media GC to find blobs no project references anymore.
export const listMediaKeys = async (): Promise<readonly string[]> => {
  if (!supportsOpfs()) return [...inMemory.keys()];
  try {
    const root = await getRoot();
    const keys: string[] = [];
    for await (const key of (root as unknown as { keys(): AsyncIterable<string> }).keys()) {
      keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
};

// Browser-quota snapshot. Returns `null` if the StorageManager API isn't
// available (e.g. older Safari).
export const getStorageUsage = async (): Promise<{
  usageBytes: number;
  quotaBytes: number;
} | null> => {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return {
    usageBytes: est.usage ?? 0,
    quotaBytes: est.quota ?? 0,
  };
};
