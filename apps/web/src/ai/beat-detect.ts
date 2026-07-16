export interface BeatOpts {
  sensitivity: number; // energy must exceed local average × this to count
  minGapMs: number; // minimum spacing between detected beats
}

const DEFAULT_BEAT_OPTS: BeatOpts = {
  sensitivity: 1.4,
  minGapMs: 250,
};

// Energy-based onset detector. Frames the signal, builds a short-time energy
// envelope, and flags local peaks that rise sharply above a moving average.
// Returns beat times in milliseconds (source-relative). Good enough to drive
// rhythmic markers without a full spectral-flux/tempo model.
export const detectBeatsFromBlob = async (
  blob: Blob,
  opts: Partial<BeatOpts> = {},
): Promise<readonly number[]> => {
  const { sensitivity, minGapMs } = { ...DEFAULT_BEAT_OPTS, ...opts };
  const arrayBuffer = await blob.arrayBuffer();
  const Ctx = window.OfflineAudioContext ?? window.AudioContext;
  const ctx = new Ctx(1, 44100, 44100) as OfflineAudioContext;
  const audio = await ctx.decodeAudioData(arrayBuffer.slice(0));
  const ch = audio.getChannelData(0);
  const sr = audio.sampleRate;

  const hop = Math.max(1, Math.floor((sr * 10) / 1000)); // 10 ms frames
  const frames: number[] = [];
  for (let i = 0; i + hop <= ch.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < hop; j++) sum += ch[i + j]! * ch[i + j]!;
    frames.push(sum / hop);
  }
  if (frames.length === 0) return [];

  // Moving average window (~400ms) for the adaptive threshold.
  const avgWin = Math.max(1, Math.floor(400 / 10));
  const minGapFrames = Math.max(1, Math.floor(minGapMs / 10));
  const beats: number[] = [];
  let lastBeat = Number.NEGATIVE_INFINITY;

  for (let i = 1; i < frames.length - 1; i++) {
    const lo = Math.max(0, i - avgWin);
    let avg = 0;
    for (let k = lo; k < i; k++) avg += frames[k]!;
    avg /= Math.max(1, i - lo);
    const e = frames[i]!;
    const isPeak = e >= frames[i - 1]! && e > frames[i + 1]!;
    if (isPeak && e > avg * sensitivity && i - lastBeat >= minGapFrames) {
      beats.push(Math.round((i * hop * 1000) / sr));
      lastBeat = i;
    }
  }
  return beats;
};
