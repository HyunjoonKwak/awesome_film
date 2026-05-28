"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Cloud, Download, Film, Loader2, Redo2, Undo2 } from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { useSaveStateStore } from "@/collab/save-state-store";
import { ExportDialog } from "@/export/export-dialog";
import { CollabBar } from "@/collab/collab-bar";
import { ProjectMenu } from "./project-menu";
import { SnapshotMenu } from "./snapshot-menu";
import { useT } from "@/i18n/use-t";
import { LanguageToggle } from "@/i18n/language-toggle";

export function TopBar() {
  const projectName = useProjectStore((s) => s.project.name);
  const renameProject = useProjectStore((s) => s.renameProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.history.past.length > 0);
  const canRedo = useProjectStore((s) => s.history.future.length > 0);
  const saveState = useSaveStateStore((s) => s.state);
  const lastSavedAt = useSaveStateStore((s) => s.lastSavedAt);
  const [exportOpen, setExportOpen] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  useEffect(() => setDraftName(projectName), [projectName]);
  const t = useT();

  return (
    <div className="flex h-full items-center justify-between gap-4 px-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-accent">
          <Film className="size-4" />
        </Link>
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => {
            if (draftName !== projectName) renameProject(draftName);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setDraftName(projectName);
          }}
          className="rounded bg-transparent px-1 text-sm font-medium text-ink-1 outline-none hover:bg-white/5 focus:bg-white/10"
        />
        <span className="text-xs text-ink-3">cut_editor</span>
        <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-ghost"
          onClick={undo}
          disabled={!canUndo}
          aria-label={t("topbar.undo")}
          title={t("topbar.undo")}
        >
          <Undo2 className="size-4" />
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={redo}
          disabled={!canRedo}
          aria-label={t("topbar.redo")}
          title={t("topbar.redo")}
        >
          <Redo2 className="size-4" />
        </button>
        <div className="mx-2 h-5 w-px bg-white/10" />
        <ProjectMenu />
        <SnapshotMenu />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <CollabBar />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <LanguageToggle />
        <div className="mx-2 h-5 w-px bg-white/10" />
        <button
          type="button"
          className="btn-primary"
          onClick={() => setExportOpen(true)}
        >
          <Download className="size-4" />
          {t("topbar.export")}
        </button>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}

function SaveBadge({ state, lastSavedAt }: { state: string; lastSavedAt: number | null }) {
  const t = useT();
  const label =
    state === "saving"
      ? t("topbar.saving")
      : state === "saved" && lastSavedAt
        ? `${t("topbar.saved")} • ${timeAgo(lastSavedAt, t)}`
        : t("topbar.localFirst");
  const Icon = state === "saving" ? Loader2 : state === "saved" ? Check : Cloud;
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-ink-3"
      title={state}
    >
      <Icon className={state === "saving" ? "size-3 animate-spin" : "size-3"} />
      {label}
    </span>
  );
}

const timeAgo = (ts: number, t: ReturnType<typeof useT>): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return t("topbar.justNow");
  if (s < 60) return t("topbar.secondsAgo", { n: s });
  const m = Math.floor(s / 60);
  return t("topbar.minutesAgo", { n: m });
};
