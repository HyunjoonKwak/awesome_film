// Audio mixer worker — runs the bus-combine + sidechain-ducking + soft-limiter
// pass off the main thread. The mixer's per-clip stage stays on main because
// it depends on `OfflineAudioContext` (decode + biquad EQ) which is unavailable
// in regular workers. Once the per-clip stage has summed everything into
// `voiceBus` and `musicBus`, those typed arrays are transferred here and the
// final PCM is transferred back — zero copies in either direction.

export interface MixerWorkerRequest {
  readonly voiceBus: Float32Array;
  readonly musicBus: Float32Array;
  readonly sampleRate: number;
  readonly ducking?: { enabled: boolean; amountDb: number; thresholdDb: number };
}

export interface MixerWorkerResponse {
  readonly pcm: Float32Array;
}

const combine = (req: MixerWorkerRequest): Float32Array => {
  const { voiceBus, musicBus, sampleRate, ducking } = req;
  const totalSamples = voiceBus.length;
  const accum = new Float32Array(totalSamples);
  if (ducking?.enabled) {
    const duckGain = 10 ** (ducking.amountDb / 20);
    const threshold = 10 ** (ducking.thresholdDb / 20);
    const win = Math.floor(sampleRate * 0.05);
    let gain = 1;
    for (let i = 0; i < totalSamples; i++) {
      let voiceLevel = 0;
      const end = Math.min(totalSamples, i + win);
      for (let j = i; j < end; j += 8) voiceLevel = Math.max(voiceLevel, Math.abs(voiceBus[j]!));
      const target = voiceLevel > threshold ? duckGain : 1;
      gain += (target - gain) * 0.002;
      accum[i] = voiceBus[i]! + musicBus[i]! * gain;
    }
  } else {
    for (let i = 0; i < totalSamples; i++) accum[i] = voiceBus[i]! + musicBus[i]!;
  }
  // Soft limiter to keep us inside [-1, 1].
  let peak = 0;
  for (let i = 0; i < accum.length; i++) peak = Math.max(peak, Math.abs(accum[i]!));
  if (peak > 1) {
    const gain = 1 / peak;
    for (let i = 0; i < accum.length; i++) accum[i]! *= gain;
  }
  return accum;
};

// Worker entry. Guarded so this module can also be imported (e.g. for type
// reuse) without crashing when there's no global `self.onmessage`.
if (typeof self !== "undefined" && "onmessage" in self) {
  (self as unknown as Worker).onmessage = (e: MessageEvent<MixerWorkerRequest>) => {
    const pcm = combine(e.data);
    (self as unknown as Worker).postMessage({ pcm } satisfies MixerWorkerResponse, [pcm.buffer]);
  };
}

// Fallback used by callers when Worker isn't available (jsdom / SSR).
export const combineInline = combine;
