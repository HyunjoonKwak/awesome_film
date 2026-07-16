// Audio mixer worker — runs the bus-combine + sidechain-ducking + soft-limiter
// pass off the main thread. The mixer's per-clip stage stays on main because
// it depends on `OfflineAudioContext` (decode + biquad EQ) which is unavailable
// in regular workers. Once the per-clip stage has summed everything into
// stereo voice/music buses, those typed arrays are transferred here and the
// final PCM channels are transferred back — zero copies in either direction.

type StereoChannels = [Float32Array, Float32Array];

export interface MixerWorkerRequest {
  readonly voiceChannels: StereoChannels;
  readonly musicChannels: StereoChannels;
  readonly sampleRate: number;
  readonly ducking?: { enabled: boolean; amountDb: number; thresholdDb: number };
}

export interface MixerWorkerResponse {
  readonly channels: StereoChannels;
}

const combine = (req: MixerWorkerRequest): StereoChannels => {
  const { voiceChannels, musicChannels, sampleRate, ducking } = req;
  const totalSamples = voiceChannels[0].length;
  const accum: StereoChannels = [
    new Float32Array(totalSamples),
    new Float32Array(totalSamples),
  ];
  if (ducking?.enabled) {
    const duckGain = 10 ** (ducking.amountDb / 20);
    const threshold = 10 ** (ducking.thresholdDb / 20);
    const win = Math.floor(sampleRate * 0.05);
    let gain = 1;
    for (let i = 0; i < totalSamples; i++) {
      let voiceLevel = 0;
      const end = Math.min(totalSamples, i + win);
      for (let j = i; j < end; j += 8) {
        voiceLevel = Math.max(
          voiceLevel,
          Math.abs(voiceChannels[0][j]!),
          Math.abs(voiceChannels[1][j]!),
        );
      }
      const target = voiceLevel > threshold ? duckGain : 1;
      gain += (target - gain) * 0.002;
      accum[0][i] = voiceChannels[0][i]! + musicChannels[0][i]! * gain;
      accum[1][i] = voiceChannels[1][i]! + musicChannels[1][i]! * gain;
    }
  } else {
    for (let channel = 0; channel < 2; channel++) {
      const output = accum[channel]!;
      const voice = voiceChannels[channel]!;
      const music = musicChannels[channel]!;
      for (let i = 0; i < totalSamples; i++) {
        output[i] = voice[i]! + music[i]!;
      }
    }
  }
  // One shared limiter gain preserves the stereo image.
  let peak = 0;
  for (const channel of accum) {
    for (let i = 0; i < channel.length; i++) peak = Math.max(peak, Math.abs(channel[i]!));
  }
  if (peak > 1) {
    const gain = 1 / peak;
    for (const channel of accum) {
      for (let i = 0; i < channel.length; i++) channel[i]! *= gain;
    }
  }
  return accum;
};

// Worker entry. Guarded so this module can also be imported (e.g. for type
// reuse) without crashing when there's no global `self.onmessage`.
if (typeof self !== "undefined" && "onmessage" in self) {
  (self as unknown as Worker).onmessage = (e: MessageEvent<MixerWorkerRequest>) => {
    const channels = combine(e.data);
    (self as unknown as Worker).postMessage({ channels } satisfies MixerWorkerResponse, [
      channels[0].buffer,
      channels[1].buffer,
    ]);
  };
}

// Fallback used by callers when Worker isn't available (jsdom / SSR).
export const combineInline = combine;
