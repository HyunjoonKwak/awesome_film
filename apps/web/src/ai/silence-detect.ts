import type { Range } from "./types";

export interface SilenceOpts {
  thresholdDb: number;   // default -45
  minSilenceMs: number;  // default 400
  paddingMs: number;     // shrink each silence by this much
}

export const DEFAULT_SILENCE_OPTS: SilenceOpts = {
  thresholdDb: -45,
  minSilenceMs: 400,
  paddingMs: 100,
};

// Decode audio from a Blob/URL and run a sliding-window RMS detector.
// Returns the silent ranges in milliseconds, suitable for handing to the
// timeline's split/remove pipeline.
export const detectSilenceFromBlob = async (
  blob: Blob,
  opts: Partial<SilenceOpts> = {},
): Promise<readonly Range[]> => {
  const { thresholdDb, minSilenceMs, paddingMs } = { ...DEFAULT_SILENCE_OPTS, ...opts };
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new (window.OfflineAudioContext ?? window.AudioContext)(
    1,
    44100,
    44100,
  ) as OfflineAudioContext;
  const audioBuf = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const ch = audioBuf.getChannelData(0);
  const sampleRate = audioBuf.sampleRate;
  const windowSamples = Math.max(1, Math.floor((sampleRate * 20) / 1000)); // 20ms window
  const threshold = Math.pow(10, thresholdDb / 20);

  const ranges: { start: number; end: number }[] = [];
  let silenceStartSample: number | null = null;

  for (let i = 0; i + windowSamples <= ch.length; i += windowSamples) {
    let sumSq = 0;
    for (let j = 0; j < windowSamples; j++) {
      const s = ch[i + j] ?? 0;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / windowSamples);
    if (rms < threshold) {
      if (silenceStartSample === null) silenceStartSample = i;
    } else if (silenceStartSample !== null) {
      ranges.push({ start: silenceStartSample, end: i });
      silenceStartSample = null;
    }
  }
  if (silenceStartSample !== null) {
    ranges.push({ start: silenceStartSample, end: ch.length });
  }

  return ranges
    .map(({ start, end }) => ({
      start: Math.round((start * 1000) / sampleRate),
      end: Math.round((end * 1000) / sampleRate),
    }))
    .map((r) => ({
      start: r.start + paddingMs,
      end: r.end - paddingMs,
    }))
    .filter((r) => r.end - r.start >= minSilenceMs);
};
