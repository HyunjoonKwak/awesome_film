"use client";

import { useState } from "react";
import { FolderOpen, Sliders, X } from "lucide-react";
import { TopBar } from "./top-bar";
import { MediaBin } from "@/media/components/media-bin";
import { PreviewViewport } from "@/preview/preview-viewport";
import { TransportBar } from "@/preview/transport-bar";
import { TimelinePanel } from "@/timeline/components/timeline-panel";
import { InspectorPanel } from "./inspector-panel";
import { RightPanel } from "./right-panel";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useCollab } from "@/collab/use-collab";
import { useIsBelow } from "@/hooks/use-breakpoint";
import { usePluginHost } from "@/plugins/use-plugin-host";
import { CommandPalette } from "./command-palette";
import { ShortcutCheatsheet } from "./shortcut-cheatsheet";

export function EditorShell() {
  useKeyboardShortcuts();
  useCollab();
  usePluginHost();
  const isMobile = useIsBelow(900);

  if (isMobile) return <MobileShell />;
  return (
    <div className="grid h-full grid-rows-[44px_1fr_36px_280px] grid-cols-[280px_1fr_320px] bg-panel-0 text-ink-1">
      <CommandPalette />
      <ShortcutCheatsheet />
      <header className="col-span-3 border-b border-white/5 bg-panel-1">
        <TopBar />
      </header>
      <aside className="col-start-1 border-r border-white/5 overflow-hidden">
        <MediaBin />
      </aside>
      <main className="col-start-2 overflow-hidden bg-black">
        <PreviewViewport />
      </main>
      <aside className="col-start-3 border-l border-white/5 overflow-hidden">
        <RightPanel />
      </aside>
      <section className="col-span-3 border-t border-white/5 bg-panel-1">
        <TransportBar />
      </section>
      <section className="col-span-3 overflow-hidden border-t border-white/5">
        <TimelinePanel />
      </section>
    </div>
  );
}

function MobileShell() {
  const [drawer, setDrawer] = useState<"media" | "inspector" | null>(null);
  return (
    <div className="flex h-full flex-col bg-panel-0 text-ink-1">
      <CommandPalette />
      <ShortcutCheatsheet />
      <header className="h-12 border-b border-white/5 bg-panel-1">
        <TopBar />
      </header>
      <main className="flex-1 overflow-hidden bg-black">
        <PreviewViewport />
      </main>
      <section className="h-10 border-t border-white/5 bg-panel-1">
        <TransportBar />
      </section>
      <section className="h-56 overflow-hidden border-t border-white/5">
        <TimelinePanel />
      </section>
      <nav className="flex h-12 items-center justify-around border-t border-white/5 bg-panel-1">
        <button
          type="button"
          onClick={() => setDrawer("media")}
          className="btn-ghost flex-1 justify-center"
        >
          <FolderOpen className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setDrawer("inspector")}
          className="btn-ghost flex-1 justify-center"
        >
          <Sliders className="size-5" />
        </button>
      </nav>

      {drawer && (
        <div className="fixed inset-0 z-50 flex flex-col bg-panel-0">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <span className="text-sm font-medium text-ink-1">
              {drawer === "media" ? "Media" : "Inspector"}
            </span>
            <button
              type="button"
              onClick={() => setDrawer(null)}
              className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {drawer === "media" ? <MediaBin /> : <InspectorPanel />}
          </div>
        </div>
      )}
    </div>
  );
}
