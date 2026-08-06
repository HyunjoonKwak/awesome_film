"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/i18n/use-t";
import { useMusicLibraryStore } from "@/stores/music-library-store";
import { fetchYoutubeMeta, isHttpUrl, isYoutubeUrl } from "../youtube-meta";
import type { MusicLicense } from "../types";

const parseTags = (raw: string): string[] => {
  const seen = new Set<string>();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => {
      const key = s.toLowerCase();
      if (!s || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const inputCls =
  "w-full rounded-md border border-white/10 bg-panel-2 px-2 py-1.5 text-xs text-ink-1 placeholder:text-ink-3 focus:border-accent focus:outline-none";

export function MusicAddForm({ onDone }: { onDone: () => void }) {
  const addRef = useMusicLibraryStore((s) => s.addRef);
  const t = useT();
  const [url, setUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [license, setLicense] = useState<MusicLicense>("unknown");
  const [sourceUrl, setSourceUrl] = useState("");
  const [moods, setMoods] = useState("");
  const [scenes, setScenes] = useState("");
  const [note, setNote] = useState("");
  const [fetching, setFetching] = useState(false);

  const onFetch = async () => {
    if (!isYoutubeUrl(url.trim())) {
      toast.error(t("music.fetchInvalid"));
      return;
    }
    setFetching(true);
    try {
      const meta = await fetchYoutubeMeta(url.trim());
      if (!meta) {
        toast.error(t("music.fetchFailed"));
        return;
      }
      setYoutubeTitle(meta.title);
      if (!title) setTitle(meta.title);
      if (!artist && meta.author) setArtist(meta.author);
    } finally {
      setFetching(false);
    }
  };

  const onSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t("music.titleRequired"));
      return;
    }
    const trimmedSource = sourceUrl.trim();
    if (trimmedSource && !isHttpUrl(trimmedSource)) {
      toast.error(t("music.sourceInvalid"));
      return;
    }
    // Only a validated YouTube URL is worth storing as one.
    const ytUrl = isYoutubeUrl(url.trim()) ? url.trim() : "";
    addRef({
      title: trimmedTitle,
      license,
      moods: parseTags(moods),
      scenes: parseTags(scenes),
      ...(artist.trim() ? { artist: artist.trim() } : {}),
      ...(trimmedSource ? { sourceUrl: trimmedSource } : {}),
      ...(ytUrl ? { youtubeUrl: ytUrl } : {}),
      ...(youtubeTitle ? { youtubeTitle } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    toast.success(t("music.saved"));
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 border-b border-white/5 bg-panel-1 p-3">
      <p className="text-2xs text-ink-3">{t("music.addHint")}</p>
      <div className="flex gap-1.5">
        <input
          className={inputCls}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("music.youtubeUrl")}
          aria-label={t("music.youtubeUrl")}
        />
        <button
          type="button"
          onClick={() => void onFetch()}
          disabled={fetching}
          aria-label={fetching ? t("music.fetching") : t("music.fetch")}
          className="shrink-0 rounded-md border border-white/10 px-2 py-1.5 text-xs text-ink-2 hover:bg-white/10 disabled:opacity-50"
        >
          {fetching ? <Loader2 className="size-3.5 animate-spin" /> : t("music.fetch")}
        </button>
      </div>
      {youtubeTitle && (
        <p className="truncate text-2xs text-ink-3">
          {t("music.fromVideo", { title: youtubeTitle })}
        </p>
      )}
      <input
        className={inputCls}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("music.trackTitle")}
        aria-label={t("music.trackTitle")}
      />
      <div className="flex gap-1.5">
        <input
          className={inputCls}
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t("music.artist")}
          aria-label={t("music.artist")}
        />
        <select
          className="shrink-0 rounded-md border border-white/10 bg-panel-2 px-2 py-1.5 text-xs text-ink-1"
          value={license}
          onChange={(e) => setLicense(e.target.value as MusicLicense)}
          aria-label={t("music.license")}
        >
          <option value="free">{t("music.license.free")}</option>
          <option value="paid">{t("music.license.paid")}</option>
          <option value="unknown">{t("music.license.unknown")}</option>
        </select>
      </div>
      <input
        className={inputCls}
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        placeholder={t("music.sourceUrl")}
        aria-label={t("music.sourceUrl")}
      />
      <input
        className={inputCls}
        value={moods}
        onChange={(e) => setMoods(e.target.value)}
        placeholder={t("music.moods")}
        aria-label={t("music.moods")}
      />
      <input
        className={inputCls}
        value={scenes}
        onChange={(e) => setScenes(e.target.value)}
        placeholder={t("music.scenes")}
        aria-label={t("music.scenes")}
      />
      <textarea
        className={`${inputCls} min-h-14 resize-y`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("music.note")}
        aria-label={t("music.note")}
      />
      <button
        type="button"
        onClick={onSave}
        className="rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-accent-fg hover:bg-accent-hover"
      >
        {t("music.save")}
      </button>
    </div>
  );
}
