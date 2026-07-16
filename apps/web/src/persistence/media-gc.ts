import type { Project } from "@cut/core";
import { deleteMediaFile, listMediaKeys } from "./opfs";
import { listProjectsLibrary, loadStoredProject } from "./project-library";

const mediaLeases = new Map<string, number>();

// A producer holds a lease from before the OPFS write until its project
// metadata is committed. Startup GC must not reap files in that atomic gap.
export const leaseMediaKey = (key: string): (() => void) => {
  mediaLeases.set(key, (mediaLeases.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = (mediaLeases.get(key) ?? 1) - 1;
    if (remaining <= 0) mediaLeases.delete(key);
    else mediaLeases.set(key, remaining);
  };
};

export const isMediaKeyLeased = (key: string): boolean => mediaLeases.has(key);

const collectKeys = (p: Project, keep: Set<string>): void => {
  for (const a of p.mediaLibrary) {
    if (a.opfsPath) keep.add(a.opfsPath);
    if (a.proxyPath) keep.add(a.proxyPath);
  }
};

// Reclaim OPFS blobs (originals + proxies) that no project references — the
// current in-memory project plus every project saved in the library. Media
// deletion is metadata-only (see media-bin), so this is what actually frees
// disk. Safe to run at startup: the active project's undo history is empty
// then and every saved project is consulted, so nothing still reachable —
// including anything an in-session Undo could restore — is removed here.
// Returns the number of blobs reclaimed.
export const collectMediaGarbage = async (current: Project): Promise<number> => {
  const keep = new Set<string>();
  collectKeys(current, keep);
  for (const row of await listProjectsLibrary()) {
    const result = await loadStoredProject(row.id);
    // A damaged row may still contain recoverable media references. Abort the
    // destructive pass instead of guessing which OPFS blobs are orphaned.
    if (result.status === "corrupt") return 0;
    if (result.status === "ok") collectKeys(result.project, keep);
  }

  let removed = 0;
  for (const key of await listMediaKeys()) {
    if (!keep.has(key) && !isMediaKeyLeased(key)) {
      await deleteMediaFile(key);
      removed++;
    }
  }
  return removed;
};
