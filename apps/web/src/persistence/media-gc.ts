import type { Project } from "@cut/core";
import { deleteMediaFile, listMediaKeys } from "./opfs";
import { getProject, listProjectsLibrary } from "./project-library";

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
    const p = await getProject(row.id);
    if (p) collectKeys(p, keep);
  }

  let removed = 0;
  for (const key of await listMediaKeys()) {
    if (!keep.has(key)) {
      await deleteMediaFile(key);
      removed++;
    }
  }
  return removed;
};
