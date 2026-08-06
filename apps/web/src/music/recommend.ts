import type { ID } from "@cut/core";
import type { MusicRef } from "./types";

// Tag-overlap recommendation over the saved music library. Deliberately
// transparent: every result carries WHY it matched so the panel can show
// the reasoning instead of an opaque ranking.

export interface MusicQuery {
  readonly moods: readonly string[];
  readonly scenes: readonly string[];
  readonly targetMs?: number; // usually the timeline duration
}

export interface AssetInfo {
  readonly durationMs: number;
}

export interface MusicRecommendation {
  readonly ref: MusicRef;
  readonly score: number;
  readonly matchedMoods: readonly string[];
  readonly matchedScenes: readonly string[];
  readonly durationFit: number | null; // 0..1, null when unknown
  readonly ready: boolean; // has a linked asset — insertable right now
}

const norm = (s: string): string => s.trim().toLowerCase();

export const recommendMusic = (
  refs: readonly MusicRef[],
  query: MusicQuery,
  assets?: ReadonlyMap<ID, AssetInfo>,
): readonly MusicRecommendation[] => {
  const qMoods = query.moods.map(norm).filter(Boolean);
  const qScenes = query.scenes.map(norm).filter(Boolean);
  const tagged = qMoods.length > 0 || qScenes.length > 0;

  const scored = refs.map((ref): MusicRecommendation => {
    const matchedMoods = ref.moods.filter((m) => qMoods.includes(norm(m)));
    const matchedScenes = ref.scenes.filter((s) => qScenes.includes(norm(s)));
    const asset = ref.assetId ? assets?.get(ref.assetId) : undefined;
    const ready = asset !== undefined;
    const durationFit =
      asset && query.targetMs && query.targetMs > 0
        ? Math.max(0, Math.min(1, asset.durationMs / query.targetMs))
        : null;
    // Count each distinct tag once even when it appears as both a mood and
    // a scene on the same ref — no double scoring.
    const matchedKeys = new Set([...matchedMoods, ...matchedScenes].map(norm));
    const score = matchedKeys.size * 2 + (ready ? 1 : 0) + (durationFit ?? 0);
    return { ref, score, matchedMoods, matchedScenes, durationFit, ready };
  });

  const kept = tagged
    ? scored.filter((r) => r.matchedMoods.length + r.matchedScenes.length > 0)
    : scored;
  return kept.toSorted((a, b) => b.score - a.score || b.ref.addedAt - a.ref.addedAt);
};

// Distinct tags across the library for the chip picker — first spelling
// wins, comparison is case/whitespace-insensitive.
const dedupe = (all: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of all) {
    const key = norm(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
};

export const collectTags = (refs: readonly MusicRef[]): { moods: string[]; scenes: string[] } => ({
  moods: dedupe(refs.flatMap((r) => r.moods)),
  scenes: dedupe(refs.flatMap((r) => r.scenes)),
});

// One flat deduped chip list — a tag used as a mood on one ref and a scene
// on another must render as a single chip.
export const collectAllTags = (refs: readonly MusicRef[]): string[] =>
  dedupe(refs.flatMap((r) => [...r.moods, ...r.scenes]));
