"use client";

import { useMemo } from "react";
import { Sliders } from "lucide-react";
import { findClip, isMediaClip, isTextClip, isShapeClip } from "@cut/core";
import { useProjectStore } from "@/stores/project-store";
import { useSelectionStore } from "@/stores/selection-store";
import { EffectsSection } from "./effects-section";
import { TextSection } from "./text-section";
import { ShapeSection } from "./shape-section";
import { TransformSection } from "./transform-section";
import { MaskSection } from "./mask-section";
import { TransitionSection } from "./transition-section";
import { SpeedSection } from "./speed-section";
import { SlipSection } from "./slip-section";
import { AudioSection } from "./audio-section";
import { KeyframeGraph } from "./keyframe-graph";
import { AiPanel } from "@/ai/ai-panel";
import { useT } from "@/i18n/use-t";

export function InspectorPanel() {
  const timeline = useProjectStore((s) => s.project.timeline);
  const media = useProjectStore((s) => s.project.mediaLibrary);
  const selected = useSelectionStore((s) => s.clipIds);
  const t = useT();

  const clip = useMemo(() => {
    const first = [...selected][0];
    if (!first) return null;
    return findClip(timeline, first) ?? null;
  }, [timeline, selected]);

  const asset = useMemo(() => {
    if (!clip || !isMediaClip(clip)) return null;
    return media.find((a) => a.id === clip.assetId) ?? null;
  }, [clip, media]);

  return (
    <div className="flex h-full flex-col">
      <div className="panel-header">
        <span className="flex items-center gap-2">
          <Sliders className="size-3.5" />
          {t("inspector.title")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {!clip && <p className="text-ink-3">{t("inspector.empty")}</p>}

        {clip && (
          <div className="space-y-4">
            <dl className="space-y-3">
              <Row label={t("inspector.kind")} value={clip.kind} />
              <Row label={t("inspector.start")} value={`${clip.start} ms`} />
              <Row label={t("inspector.duration")} value={`${clip.duration} ms`} />
              <Row label={t("inspector.speed")} value={`${clip.speed}x`} />
              {asset && (
                <>
                  <hr className="border-white/5" />
                  <Row label={t("inspector.asset")} value={asset.name} />
                  <Row label={t("inspector.assetDuration")} value={`${asset.durationMs} ms`} />
                  {asset.width && asset.height && (
                    <Row label={t("inspector.resolution")} value={`${asset.width}×${asset.height}`} />
                  )}
                </>
              )}
            </dl>
            {isTextClip(clip) && (
              <>
                <hr className="border-white/5" />
                <TextSection clip={clip} />
              </>
            )}
            {isShapeClip(clip) && (
              <>
                <hr className="border-white/5" />
                <ShapeSection clip={clip} />
              </>
            )}
            <hr className="border-white/5" />
            <TransformSection clipId={clip.id} clip={clip} />
            <hr className="border-white/5" />
            <MaskSection clipId={clip.id} clip={clip} />
            {isMediaClip(clip) && (
              <>
                <hr className="border-white/5" />
                <SpeedSection clipId={clip.id} clip={clip} />
                <hr className="border-white/5" />
                <SlipSection clip={clip} />
                <hr className="border-white/5" />
                <AudioSection clip={clip} />
              </>
            )}
            <hr className="border-white/5" />
            <TransitionSection clipId={clip.id} clip={clip} />
            <hr className="border-white/5" />
            <EffectsSection clipId={clip.id} effects={clip.effects} />
            {clip.keyframes.length > 0 && (
              <>
                <hr className="border-white/5" />
                <KeyframeGraph clipId={clip.id} clip={clip} />
              </>
            )}
            <hr className="border-white/5" />
            <AiPanel />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="font-mono text-xs text-ink-1">{value}</dd>
    </div>
  );
}
