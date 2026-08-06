"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Music2, Trash2, Unlink, Youtube } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import type { MessageKey } from "@/i18n/messages";
import { useT } from "@/i18n/use-t";
import { importMediaFile } from "@/media/import";
import { leaseMediaKey } from "@/persistence/media-gc";
import { readMediaFile } from "@/persistence/opfs";
import { useMusicLibraryStore } from "@/stores/music-library-store";
import { useProjectStore } from "@/stores/project-store";
import type { ID } from "@cut/core";
import {
  audioMimeFor,
  hashBlob,
  musicStoreKey,
  readMusicFile,
  safeFileName,
  saveMusicFile,
} from "../file-store";
import type { MusicRecommendation } from "../recommend";
import type { MusicLicense, MusicRef } from "../types";

const LICENSE_CLS: Record<MusicLicense, string> = {
  free: "bg-emerald-500/15 text-emerald-300",
  paid: "bg-amber-500/15 text-amber-300",
  unknown: "bg-white/10 text-ink-3",
};

const LICENSE_KEY: Record<MusicLicense, MessageKey> = {
  free: "music.license.free",
  paid: "music.license.paid",
  unknown: "music.license.unknown",
};

export function MusicRefCard({
  musicRef,
  recommendation,
}: {
  musicRef: MusicRef;
  recommendation?: MusicRecommendation;
}) {
  const updateRef = useMusicLibraryStore((s) => s.updateRef);
  const clearAssetLink = useMusicLibraryStore((s) => s.clearAssetLink);
  const removeRef = useMusicLibraryStore((s) => s.removeRef);
  const mediaLibrary = useProjectStore((s) => s.project.mediaLibrary);
  const addMusicBed = useProjectStore((s) => s.addMusicBed);
  const [restoring, setRestoring] = useState(false);
  const t = useT();

  // Link an asset from this project's media bin, and copy its bytes into
  // the app-global music store in the background so every other project
  // can restore the file without a manual re-import.
  const linkAsset = (assetId: ID) => {
    updateRef(musicRef.id, { assetId });
    const asset = mediaLibrary.find((a) => a.id === assetId);
    if (!asset) return;
    void (async () => {
      try {
        const blob = await readMediaFile(asset.opfsPath);
        if (!blob) return;
        const fileHash = await hashBlob(blob);
        // Leased across the write→ref-commit gap so GC can't reap it.
        const releaseStore = leaseMediaKey(musicStoreKey(fileHash));
        try {
          const name = safeFileName(asset.name);
          await saveMusicFile(fileHash, new File([blob], name, { type: blob.type }));
          updateRef(musicRef.id, { fileHash, fileName: name });
        } finally {
          releaseStore();
        }
      } catch {
        // The project-local link still works; only cross-project restore is lost.
      }
    })();
  };

  // Cross-project one-click: pull the audio out of the global store,
  // import it into THIS project's media bin, relink and lay the bed.
  const restoreAndBed = async () => {
    if (!musicRef.fileHash || restoring) return;
    // Same file already in this project's bin (matched by stored name)?
    // Relink instead of importing a duplicate copy.
    const already = musicRef.fileName
      ? mediaLibrary.find((a) => a.kind === "audio" && a.name === musicRef.fileName)
      : undefined;
    if (already) {
      updateRef(musicRef.id, { assetId: already.id });
      if (useProjectStore.getState().addMusicBed(already.id)) {
        toast.success(t("music.bedAdded", { name: musicRef.title }));
      } else {
        toast.error(t("music.bedNoRoom"));
      }
      return;
    }
    setRestoring(true);
    try {
      const blob = await readMusicFile(musicRef.fileHash);
      if (!blob) {
        toast.error(t("music.restoreMissing"));
        return;
      }
      const name = safeFileName(musicRef.fileName ?? `${musicRef.title}.mp3`);
      const file = new File([blob], name, {
        type: blob.type || audioMimeFor(name),
      });
      const { asset, releaseLease } = await importMediaFile(file);
      try {
        useProjectStore.getState().addMediaAsset(asset);
      } finally {
        releaseLease();
      }
      updateRef(musicRef.id, { assetId: asset.id });
      if (useProjectStore.getState().addMusicBed(asset.id)) {
        toast.success(t("music.bedAdded", { name: musicRef.title }));
      } else {
        toast.error(t("music.bedNoRoom"));
      }
    } catch {
      toast.error(t("music.importFailed"));
    } finally {
      setRestoring(false);
    }
  };

  // The linked asset lives in the CURRENT project's media bin — in another
  // project the link simply reads as "not linked yet".
  const linkedAsset = musicRef.assetId
    ? mediaLibrary.find((a) => a.id === musicRef.assetId && a.kind === "audio")
    : undefined;
  const audioAssets = mediaLibrary.filter((a) => a.kind === "audio");
  const matchedTags = recommendation
    ? [...recommendation.matchedMoods, ...recommendation.matchedScenes]
    : [];

  return (
    <div className="rounded-md border border-white/5 bg-panel-2 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-1">
            {musicRef.title}
            {musicRef.artist && <span className="text-ink-3"> · {musicRef.artist}</span>}
          </p>
          {musicRef.youtubeTitle && (
            <p className="mt-0.5 truncate text-2xs text-ink-3">
              {t("music.fromVideo", { title: musicRef.youtubeTitle })}
            </p>
          )}
        </div>
        <span
          className={cn("shrink-0 rounded px-1.5 py-0.5 text-2xs", LICENSE_CLS[musicRef.license])}
        >
          {t(LICENSE_KEY[musicRef.license])}
        </span>
      </div>

      {(musicRef.moods.length > 0 || musicRef.scenes.length > 0) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {[...musicRef.moods, ...musicRef.scenes].map((tag) => (
            <span
              key={tag}
              className={cn(
                "rounded-full px-1.5 py-0.5 text-2xs",
                matchedTags.includes(tag) ? "bg-accent/20 text-accent" : "bg-white/5 text-ink-2",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {musicRef.note && <p className="mt-1.5 text-2xs italic text-ink-3">{musicRef.note}</p>}

      {recommendation && (
        <p className="mt-1.5 text-2xs text-ink-3">
          {recommendation.ready && (
            <span className="mr-2 text-emerald-300">{t("music.ready")}</span>
          )}
          {recommendation.durationFit !== null &&
            t("music.durationFit", { pct: Math.round(recommendation.durationFit * 100) })}
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        {linkedAsset ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (addMusicBed(linkedAsset.id)) {
                  toast.success(t("music.bedAdded", { name: musicRef.title }));
                } else {
                  toast.error(t("music.bedNoRoom"));
                }
              }}
              className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-2xs font-medium text-accent-fg hover:bg-accent-hover"
            >
              <Music2 className="size-3" />
              {t("music.addBed")}
            </button>
            <button
              type="button"
              onClick={() => clearAssetLink(musicRef.id)}
              title={t("music.unlink")}
              className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            >
              <Unlink className="size-3" />
            </button>
          </>
        ) : (
          <>
            {musicRef.fileHash && (
              <button
                type="button"
                onClick={() => void restoreAndBed()}
                disabled={restoring}
                className="flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-2xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
              >
                {restoring ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Music2 className="size-3" />
                )}
                {t("music.restoreBed")}
              </button>
            )}
            {audioAssets.length > 0 ? (
              <select
                className="max-w-40 rounded-md border border-white/10 bg-panel-1 px-1.5 py-1 text-2xs text-ink-2"
                value=""
                onChange={(e) => {
                  if (e.target.value) linkAsset(e.target.value as ID);
                }}
                title={t("music.linkAssetHint")}
              >
                <option value="">{t("music.linkAsset")}</option>
                {audioAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              !musicRef.fileHash && (
                <span className="text-2xs text-ink-3">{t("music.noAudioAssets")}</span>
              )
            )}
          </>
        )}
        <div className="ml-auto flex gap-1">
          {musicRef.youtubeUrl && (
            <a
              href={musicRef.youtubeUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={t("music.openYoutube")}
              className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            >
              <Youtube className="size-3.5" />
            </a>
          )}
          {musicRef.sourceUrl && (
            <a
              href={musicRef.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={t("music.openSource")}
              className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              removeRef(musicRef.id);
              toast.success(t("music.deleted"));
            }}
            title={t("music.delete")}
            className="rounded p-1 text-ink-3 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
