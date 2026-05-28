"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FilePlus, FolderOpen, Trash2, Upload, Download, X } from "lucide-react";
import { toast } from "sonner";
import { createEmptyProject, type Project } from "@cut/core";
import { useProjectStore } from "@/stores/project-store";
import { useT } from "@/i18n/use-t";
import {
  deleteStoredProject,
  listProjectsLibrary,
  setActiveProjectId,
  upsertProject,
} from "@/persistence/project-library";
import { downloadProjectJson, parseProjectExport } from "@/persistence/project-export";

interface StoredRow {
  id: string;
  name: string;
  updatedAt: number;
}

export function ProjectMenu() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StoredRow[]>([]);
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();

  // Auto-save active project into the multi-project library whenever it
  // changes — so reopening picks up the latest state without manual save.
  useEffect(() => {
    void upsertProject(project);
    void setActiveProjectId(project.id);
  }, [project]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open]);

  const refresh = async () => {
    const all = await listProjectsLibrary();
    setRows(all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })));
  };

  const onNew = async () => {
    const fresh = createEmptyProject({ name: t("project.untitled") });
    loadProject(fresh);
    await upsertProject(fresh);
    await setActiveProjectId(fresh.id);
    setOpen(false);
    toast.success(t("project.created"));
  };

  const onOpen = async (id: string) => {
    const all = await listProjectsLibrary();
    const row = all.find((r) => r.id === id);
    if (!row) return;
    const loaded = JSON.parse(row.json) as Project;
    loadProject(loaded);
    await setActiveProjectId(id);
    setOpen(false);
    toast.success(t("project.opened", { name: row.name }));
  };

  const onDelete = async (id: string) => {
    await deleteStoredProject(id);
    await refresh();
  };

  const onExport = () => downloadProjectJson(project);

  const onImport = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      const env = parseProjectExport(raw);
      loadProject(env.project);
      await upsertProject(env.project);
      await setActiveProjectId(env.project.id);
      setOpen(false);
      toast.success(t("project.imported", { name: env.project.name }));
    } catch (err) {
      toast.error(
        `${t("project.importFailed")}: ${err instanceof Error ? err.message : err}`,
      );
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="btn-ghost px-2 py-1 text-xs"
          title={t("project.menu")}
        >
          <FolderOpen className="size-3.5" />
          {t("project.menu")}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-panel-1 p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-medium text-ink-1">
              {t("project.menu")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={onNew} className="btn-ghost">
              <FilePlus className="size-3.5" /> {t("project.new")}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost"
            >
              <Upload className="size-3.5" /> {t("project.import")}
            </button>
            <button type="button" onClick={onExport} className="btn-ghost">
              <Download className="size-3.5" /> {t("project.export")}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
          </div>

          <ul className="mt-4 max-h-72 space-y-1 overflow-y-auto">
            {rows.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-ink-3">
                {t("project.empty")}
              </li>
            )}
            {rows.map((row) => (
              <li
                key={row.id}
                className="group flex items-center justify-between rounded-md border border-white/5 bg-panel-2 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onOpen(row.id)}
                  className="flex-1 text-left text-sm text-ink-1 hover:text-accent"
                >
                  <span className="block font-medium">{row.name}</span>
                  <span className="block text-[10px] text-ink-3">
                    {new Date(row.updatedAt).toLocaleString()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  className="rounded p-1 text-ink-3 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100"
                  title={t("project.delete")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
