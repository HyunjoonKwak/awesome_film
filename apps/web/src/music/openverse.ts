// Openverse (WordPress foundation) CC-licensed audio search. Keyless, CORS
// -enabled (verified), returns direct audio URLs plus the source landing
// page and license code. We only ever surface https URLs.

export interface FreeTrack {
  readonly id: string;
  readonly title: string;
  readonly creator: string;
  readonly audioUrl: string;
  readonly landingUrl: string;
  readonly license: string; // cc license slug: "cc0", "by", "by-nc", …
  readonly durationMs: number | null;
}

const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
};

export const toFreeTrack = (raw: unknown): FreeTrack | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const audioUrl = httpsUrl(r.url);
  if (!audioUrl) return null;
  if (typeof r.id !== "string" || !r.id) return null;
  if (typeof r.title !== "string" || !r.title) return null;
  return {
    id: r.id,
    title: r.title,
    creator: typeof r.creator === "string" ? r.creator : "",
    audioUrl,
    landingUrl: httpsUrl(r.foreign_landing_url) ?? audioUrl,
    license: typeof r.license === "string" ? r.license : "cc",
    durationMs: typeof r.duration === "number" && r.duration > 0 ? r.duration : null,
  };
};

export const searchFreeMusic = async (query: string): Promise<readonly FreeTrack[]> => {
  const q = query.trim();
  if (!q) return [];
  // license_type filter: an editing app makes derivative works and users
  // may monetize — ND (no-derivatives) and NC results would be legal traps.
  const endpoint = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q)}&category=music&page_size=10&license_type=commercial,modification`;
  const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const data = (await res.json()) as { results?: unknown[] };
  if (!Array.isArray(data.results)) return [];
  return data.results.map(toFreeTrack).filter((t): t is FreeTrack => t !== null);
};
