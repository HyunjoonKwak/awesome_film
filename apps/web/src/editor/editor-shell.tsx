"use client";

import { useState } from "react";
import { FolderOpen, Sliders, X } from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TopBar } from "./top-bar";
import { MediaBin } from "@/media/components/media-bin";
import { PreviewViewport } from "@/preview/preview-viewport";
import { TransportBar } from "@/preview/transport-bar";
import { TimelinePanel } from "@/timeline/components/timeline-panel";
import { InspectorPanel } from "./inspector-panel";
import { RightPanel } from "./right-panel";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useGlobalFileDrop } from "@/hooks/use-global-file-drop";
import { useIsDesktopApp } from "@/hooks/use-is-desktop-app";
import { useCollab } from "@/collab/use-collab";
import { useIsBelow } from "@/hooks/use-breakpoint";
import { cn } from "@/lib/cn";
import { usePluginHost } from "@/plugins/use-plugin-host";
import { CommandPalette } from "./command-palette";
import { ShortcutCheatsheet } from "./shortcut-cheatsheet";

export function EditorShell() {
  useKeyboardShortcuts();
  useGlobalFileDrop();
  useCollab();
  usePluginHost();
  const isMobile = useIsBelow(900);
  const isDesktopApp = useIsDesktopApp();

  if (isMobile) return <MobileShell />;
  return (
    <div className="flex h-full flex-col bg-panel-0 text-ink-1">
      <CommandPalette />
      <ShortcutCheatsheet />
      <header
        className={cn(
          "h-11 shrink-0 border-b border-white/5 bg-panel-1",
          // Electron hiddenInset window: leave room for the traffic lights
          // and let the bar double as the draggable title bar.
          isDesktopApp && "app-region-drag pl-[72px]",
        )}
      >
        <TopBar />
      </header>
      {/* Resizable workspace, FCP-style: browser | viewer | inspector on
          top, timeline below. Split ratios persist via autoSaveId. */}
      <PanelGroup direction="vertical" autoSaveId="cut:layout-rows" className="flex-1">
        <Panel defaultSize={62} minSize={30}>
          <PanelGroup direction="horizontal" autoSaveId="cut:layout-cols">
            <Panel
              defaultSize={18}
              minSize={12}
              collapsible
              collapsedSize={0}
              className="overflow-hidden border-r border-white/5"
            >
              <MediaBin />
            </Panel>
            <ResizeHandle orientation="vertical" />
            <Panel minSize={30}>
              <main className="flex h-full flex-col overflow-hidden bg-black">
                <div className="min-h-0 flex-1">
                  <PreviewViewport />
                </div>
                {/* Transport controls live with the viewer, FCP-style. */}
                <div className="h-10 shrink-0 border-t border-white/5 bg-panel-1">
                  <TransportBar />
                </div>
              </main>
            </Panel>
            <ResizeHandle orientation="vertical" />
            <Panel
              defaultSize={20}
              minSize={14}
              collapsible
              collapsedSize={0}
              className="overflow-hidden border-l border-white/5"
            >
              <RightPanel />
            </Panel>
          </PanelGroup>
        </Panel>
        <ResizeHandle orientation="horizontal" />
        <Panel defaultSize={38} minSize={15} className="overflow-hidden border-t border-white/5">
          <TimelinePanel />
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Slim divider that widens its hit area on hover and highlights while
// dragging. `orientation` refers to the divider line itself.
function ResizeHandle({ orientation }: { orientation: "vertical" | "horizontal" }) {
  return (
    <PanelResizeHandle
      className={cn(
        "bg-white/5 transition-colors hover:bg-accent/60 data-[resize-handle-active]:bg-accent",
        orientation === "vertical" ? "w-[3px]" : "h-[3px]",
      )}
    />
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
