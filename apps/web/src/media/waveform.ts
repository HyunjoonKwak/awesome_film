// Extract a downsampled peak envelope from an audio/video file's audio track.
// Returns absolute-max peaks in [0,1], `buckets` long, or null if decoding
// fails (e.g. a silent video with no audio track).

const DEFAULT_BUCKETS = 800;

export const extractWaveformPeaks = async (
  file: Blob,
  buckets = DEFAULT_BUCKETS,
): Promise<number[] | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const Ctx = window.OfflineAudioContext ?? window.AudioContext;
    // Use a throwaway short context just to decode; sample rate irrelevant.
    const ctx = new Ctx(1, 1, 44100) as OfflineAudioContext;
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const ch = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(ch.length / buckets));
    const peaks: number[] = [];
    for (let b = 0; b < buckets; b++) {
      let max = 0;
      const start = b * blockSize;
      const end = Math.min(ch.length, start + blockSize);
      for (let i = start; i < end; i++) {
        const v = Math.abs(ch[i]!);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    // Normalize so the loudest peak hits 1 for consistent display.
    const globalMax = peaks.reduce((m, p) => Math.max(m, p), 0);
    if (globalMax > 0) {
      for (let i = 0; i < peaks.length; i++) peaks[i]! /= globalMax;
    }
    return peaks;
  } catch {
    return null;
  }
};
