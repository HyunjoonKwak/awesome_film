import type { MusicLicense } from "./types";

// Parse pasted YouTube description text into music credits. Understands
// the auto-generated "Music in this video" block (label on one line, value
// on the next — English and Korean UI labels) and common manual credit
// lines ("Music: Artist - Title"). Runs entirely locally on pasted text,
// so it works identically in the browser, PWA and desktop app.

export interface ParsedCredit {
  readonly song?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly licensedBy?: string;
  readonly licenseGuess: MusicLicense;
}

type Field = "song" | "artist" | "album" | "licensedBy";
type Style = "inline" | "block";

// Broad labels ("music", "track") are colon-style only — as block labels
// they'd swallow the next ordinary description line ("music\nby the sea…").
const INLINE_ONLY_SONG_LABELS = ["music", "track", "음악"];

const LABELS: Record<Field, readonly string[]> = {
  song: ["song", "노래", "곡"],
  artist: ["artist", "아티스트", "가수"],
  album: ["album", "앨범"],
  licensedBy: [
    "licensed to youtube by",
    "licenses",
    "license",
    "youtube 라이선스 제공업체",
    "라이선스",
  ],
};

const FREE_MARKERS =
  /creative commons|no ?copyright|\bncs\b|audio library|royalty[- ]?free|free to use|공유마당/i;
const PAID_MARKERS =
  /epidemic sound|artlist|musicbed|audio network|audiojungle|premium beat|\bmerlin\b|believe|sme\b|umg\b|warner|kobalt|cd ?baby|distrokid|bmi\b|ascap/i;

// Guess strictly from the credit's own licensor line — falling back to the
// whole pasted text would leak one track's licensor onto another.
const guessLicense = (licensedBy: string | undefined): MusicLicense => {
  if (!licensedBy) return "unknown";
  if (FREE_MARKERS.test(licensedBy)) return "free";
  if (PAID_MARKERS.test(licensedBy)) return "paid";
  return "unknown";
};

const fieldForLabel = (label: string, style: Style): Field | null => {
  const key = label.trim().toLowerCase().replace(/:$/, "");
  if (style === "inline" && INLINE_ONLY_SONG_LABELS.includes(key)) return "song";
  for (const [field, names] of Object.entries(LABELS) as [Field, readonly string[]][]) {
    if (names.includes(key)) return field;
  }
  return null;
};

// Values that are clearly not a song/artist name — links and timecodes
// commonly follow "Music:" in ordinary descriptions.
const JUNK_VALUE = /^https?:\/\/|^\d{1,2}:\d{2}/i;

type Draft = Partial<Record<Field, string>>;

const toCredit = (draft: Draft): ParsedCredit | null => {
  if (!draft.song && !draft.artist) return null;
  return {
    ...(draft.song ? { song: draft.song } : {}),
    ...(draft.artist ? { artist: draft.artist } : {}),
    ...(draft.album ? { album: draft.album } : {}),
    ...(draft.licensedBy ? { licensedBy: draft.licensedBy } : {}),
    licenseGuess: guessLicense(draft.licensedBy),
  };
};

export const parseYoutubeCredits = (text: string): readonly ParsedCredit[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const credits: ParsedCredit[] = [];
  let draft: Draft = {};

  const assign = (field: Field, rawValue: string, style: Style) => {
    const value = rawValue.trim();
    if (!value) return;
    if ((field === "song" || field === "artist") && JUNK_VALUE.test(value)) return;
    // A second song label starts the next credit entry.
    if (field === "song" && draft.song) {
      const done = toCredit(draft);
      if (done) credits.push(done);
      draft = {};
    }
    // Manual style "Music: Artist - Title" carries both fields at once —
    // but ONLY inline: block-style values are verbatim song titles, and
    // "Fly Away - Radio Edit" must survive intact.
    if (field === "song" && style === "inline" && !draft.artist && value.includes(" - ")) {
      const [artist, ...rest] = value.split(" - ");
      draft.artist = artist!.trim();
      draft.song = rest.join(" - ").trim();
      return;
    }
    draft[field] = value;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const field = fieldForLabel(line.slice(0, colonIdx), "inline");
      if (field) {
        assign(field, line.slice(colonIdx + 1), "inline");
        continue;
      }
    }
    const field = fieldForLabel(line, "block");
    if (field) {
      // Block style: the value sits on the next non-empty line.
      let j = i + 1;
      while (j < lines.length && !lines[j]) j++;
      if (j < lines.length) {
        assign(field, lines[j]!, "block");
        i = j;
      }
    }
  }

  const last = toCredit(draft);
  if (last) credits.push(last);
  return credits;
};
