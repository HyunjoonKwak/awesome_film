// Minimal SRT / WebVTT parser + serializer. Round-trips the cues; we don't
// preserve formatting tags (<i>, color, position) yet.

export interface SubtitleCue {
  readonly start: number; // ms
  readonly end: number;   // ms
  readonly text: string;
}

const SRT_TIME = /^(\d{1,2}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})$/;

const parseTime = (s: string): number => {
  const m = s.trim().match(SRT_TIME);
  if (!m) return Number.NaN;
  const [, hh, mm, ss, ms] = m;
  return (
    Number(hh) * 3_600_000 +
    Number(mm) * 60_000 +
    Number(ss) * 1000 +
    Number(ms!.padEnd(3, "0"))
  );
};

const fmtTime = (ms: number, sep: "," | "."): string => {
  const total = Math.max(0, Math.floor(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(millis, 3)}`;
};

export const parseSrt = (text: string): readonly SubtitleCue[] => {
  const blocks = text.replace(/\r\n?/g, "\n").trim().split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter(Boolean);
    if (lines.length < 2) continue;
    // Optional numeric index on first line.
    const timeLine = lines[0]!.includes("-->") ? lines[0]! : lines[1]!;
    const textLines = lines[0]!.includes("-->") ? lines.slice(1) : lines.slice(2);
    const [startStr, endStr] = timeLine.split(/\s*-->\s*/);
    if (!startStr || !endStr) continue;
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    cues.push({ start, end, text: textLines.join("\n") });
  }
  return cues;
};

export const parseVtt = (text: string): readonly SubtitleCue[] => {
  // VTT differs from SRT mostly in the `WEBVTT` header and `.` separator.
  // Strip the header and reuse the SRT parser; both share the same cue body
  // format for our purposes.
  const stripped = text.replace(/^WEBVTT[^\n]*\n+/, "");
  return parseSrt(stripped);
};

export const toSrt = (cues: readonly SubtitleCue[]): string => {
  return `${cues
    .map(
      (c, i) =>
        `${i + 1}\n${fmtTime(c.start, ",")} --> ${fmtTime(c.end, ",")}\n${c.text}`,
    )
    .join("\n\n")}\n`;
};

export const toVtt = (cues: readonly SubtitleCue[]): string => {
  return `WEBVTT\n\n${cues
    .map(
      (c) => `${fmtTime(c.start, ".")} --> ${fmtTime(c.end, ".")}\n${c.text}`,
    )
    .join("\n\n")}\n`;
};
