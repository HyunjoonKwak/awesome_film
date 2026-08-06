"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/use-t";
import { useMusicLibraryStore } from "@/stores/music-library-store";
import { useProjectStore } from "@/stores/project-store";
import { collectAllTags, collectTags, recommendMusic } from "../recommend";
import { MusicRefCard } from "./music-ref-card";

const MAX_RESULTS = 5;

export function MusicRecommend() {
  const refs = useMusicLibraryStore((s) => s.refs);
  const mediaLibrary = useProjectStore((s) => s.project.mediaLibrary);
  const targetMs = useProjectStore((s) => s.project.timeline.duration);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const t = useT();

  const tags = useMemo(() => collectTags(refs), [refs]);
  const results = useMemo(() => {
    const assets = new Map(
      mediaLibrary
        .filter((a) => a.kind === "audio")
        .map((a) => [a.id, { durationMs: a.durationMs }]),
    );
    const pick = (pool: readonly string[]) => pool.filter((tag) => selected.has(tag));
    return recommendMusic(
      refs,
      { moods: pick(tags.moods), scenes: pick(tags.scenes), targetMs },
      assets,
    ).slice(0, MAX_RESULTS);
  }, [refs, mediaLibrary, targetMs, selected, tags]);

  if (refs.length === 0) return null;
  const allTags = collectAllTags(refs);

  const toggle = (tag: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });

  return (
    <div className="border-b border-white/5 p-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-3">
        <Sparkles className="size-3.5" />
        {t("music.recommendTitle")}
      </p>
      <p className="mt-1 text-2xs text-ink-3">{t("music.recommendHint")}</p>
      {allTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={cn(
                "rounded-full px-2 py-0.5 text-2xs transition",
                selected.has(tag)
                  ? "bg-accent text-accent-fg"
                  : "bg-white/5 text-ink-2 hover:bg-white/10",
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
      {/* Results only render once tags are picked — the untagged "all refs"
          ranking would just duplicate the library list below. */}
      {selected.size > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {results.length === 0 && (
            <p className="text-2xs text-ink-3">{t("music.recommendEmpty")}</p>
          )}
          {results.map((r) => (
            <MusicRefCard key={r.ref.id} musicRef={r.ref} recommendation={r} />
          ))}
        </div>
      )}
    </div>
  );
}
