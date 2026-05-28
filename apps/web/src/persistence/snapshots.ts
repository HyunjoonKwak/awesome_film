// Named project snapshots — git-style "save points" stored in IndexedDB,
// independent of the live Yjs doc. Each snapshot is a frozen JSON of the
// project at a moment in time.

import Dexie, { type Table } from "dexie";
import type { Project } from "@cut/core";

export interface ProjectSnapshot {
  id: string;
  projectId: string;
  label: string;
  createdAt: number;
  json: string;
}

class SnapshotDB extends Dexie {
  snapshots!: Table<ProjectSnapshot, string>;
  constructor() {
    super("cut_editor.snapshots.v1");
    this.version(1).stores({
      snapshots: "id, projectId, createdAt",
    });
  }
}

let db: SnapshotDB | null = null;
const getDb = () => {
  if (!db) db = new SnapshotDB();
  return db;
};

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const saveSnapshot = async (project: Project, label: string): Promise<void> => {
  await getDb().snapshots.put({
    id: randomId(),
    projectId: project.id,
    label: label || new Date().toLocaleString(),
    createdAt: Date.now(),
    json: JSON.stringify(project),
  });
};

export const listSnapshots = async (projectId: string): Promise<readonly ProjectSnapshot[]> =>
  getDb()
    .snapshots.where("projectId")
    .equals(projectId)
    .reverse()
    .sortBy("createdAt");

export const loadSnapshot = async (id: string): Promise<Project | null> => {
  const row = await getDb().snapshots.get(id);
  return row ? (JSON.parse(row.json) as Project) : null;
};

export const deleteSnapshot = async (id: string): Promise<void> => {
  await getDb().snapshots.delete(id);
};
