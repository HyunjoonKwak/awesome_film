"use client";

import { useState } from "react";
import { Activity, Clapperboard, FileText, MapPin, ShieldCheck, Sliders } from "lucide-react";
import { cn } from "@/lib/cn";
import { InspectorPanel } from "./inspector-panel";
import { SubtitlePanel } from "@/subtitles/subtitle-panel";
import { ScopesPanel } from "@/preview/scopes-panel";
import { MulticamPanel } from "./multicam-panel";
import { MarkerPanel } from "./marker-panel";
import { ProjectInspectorPanel } from "./project-inspector-panel";
import { useT } from "@/i18n/use-t";

type Tab = "inspector" | "subs" | "scopes" | "multicam" | "markers" | "inspect";

export function RightPanel() {
  const [tab, setTab] = useState<Tab>("inspector");
  const t = useT();

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-white/5">
        <TabButton
          active={tab === "inspector"}
          onClick={() => setTab("inspector")}
          icon={<Sliders className="size-3.5" />}
          label={t("inspector.title")}
        />
        <TabButton
          active={tab === "subs"}
          onClick={() => setTab("subs")}
          icon={<FileText className="size-3.5" />}
          label={t("subs.tab")}
        />
        <TabButton
          active={tab === "scopes"}
          onClick={() => setTab("scopes")}
          icon={<Activity className="size-3.5" />}
          label={t("scopes.tab")}
        />
        <TabButton
          active={tab === "multicam"}
          onClick={() => setTab("multicam")}
          icon={<Clapperboard className="size-3.5" />}
          label={t("multicam.tab")}
        />
        <TabButton
          active={tab === "markers"}
          onClick={() => setTab("markers")}
          icon={<MapPin className="size-3.5" />}
          label={t("marker.tab")}
        />
        <TabButton
          active={tab === "inspect"}
          onClick={() => setTab("inspect")}
          icon={<ShieldCheck className="size-3.5" />}
          label={t("inspect.tab")}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === "inspector" && <InspectorPanel />}
        {tab === "subs" && <SubtitlePanel />}
        {tab === "scopes" && <ScopesPanel />}
        {tab === "multicam" && <MulticamPanel />}
        {tab === "markers" && <MarkerPanel />}
        {tab === "inspect" && <ProjectInspectorPanel />}
      </div>
    </div>
  );
}

// Icon-only tabs — six labels don't fit a ~300px panel without wrapping.
// The label lives in the tooltip/aria-label, and the active tab shows it
// inline since the active state frees up the most attention.
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-[11px] transition",
        active
          ? "border-accent text-ink-1"
          : "border-transparent text-ink-3 hover:text-ink-1",
      )}
    >
      {icon}
      {active && <span className="truncate uppercase tracking-wider">{label}</span>}
    </button>
  );
}
