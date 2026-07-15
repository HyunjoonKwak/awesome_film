import type { ID, MediaAsset, Project } from "@cut/core";
import { isMediaClip, sampleKeyframeTrack, type EffectInstance } from "@cut/core";
import { readMediaFile } from "@/persistence/opfs";
import { combineInline } from "./audio-mixer-worker";
import { denoise } from "./spectral-denoise";

const dbToGain = (db: number): number => 10 ** (db / 20);

// Render a mono buffer through a low-shelf / mid-peaking / high-shelf biquad
// chain using an OfflineAudioContext. Crossover points follow common DAW
// 3-band defaults (≈320 Hz, ≈3.2 kHz).
const applyBiquadEq = async (
  pcm: Float32Array,
  sampleRate: number,
  lowDb: number,
  midDb: number,
  highDb: number,
): Promise<Float32Array> => {
  if (pcm.length === 0) return pcm;
  const ctx = new OfflineAudioContext(1, pcm.length, sampleRate);
  const source = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
  // Copy into the channel via a plain (non-shared) typed array to satisfy
  // copyToChannel's ArrayBuffer-backed signature.
  buffer.copyToChannel(Float32Array.from(pcm), 0);
  source.buffer = buffer;

  const low = ctx.createBiquadFilter();
  low.type = "lowshelf";
  low.frequency.value = 320;
  low.gain.value = lowDb;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1000;
  mid.Q.value = 0.8;
  mid.gain.value = midDb;

  const high = ctx.createBiquadFilter();
  high.type = "highshelf";
  high.frequency.value = 3200;
  high.gain.value = highDb;

  source.connect(low);
  low.connect(mid);
  mid.connect(high);
  high.connect(ctx.destination);
  source.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
};

// Per-clip audio effect chain. Gain & fade are cheap in-buffer; EQ uses a
// real biquad render. Returns a fresh buffer; never mutates the input.
const applyAudioEffects = async (
  pcm: Float32Array,
  effects: readonly EffectInstance[],
  sampleRate: number,
): Promise<Float32Array> => {
  let buf = pcm;
  for (const fx of effects) {
    if (!fx.enabled) continue;
    switch (fx.type) {
      case "audio-gain": {
        const g = dbToGain(Number(fx.params.db ?? 0));
        if (g === 1) break;
        buf = buf.slice();
        for (let i = 0; i < buf.length; i++) buf[i]! *= g;
        break;
      }
      case "audio-fade": {
        const inMs = Number(fx.params.fadeInMs ?? 0);
        const outMs = Number(fx.params.fadeOutMs ?? 0);
        if (inMs === 0 && outMs === 0) break;
        buf = buf.slice();
        const inSamples = Math.floor((inMs / 1000) * sampleRate);
        const outSamples = Math.floor((outMs / 1000) * sampleRate);
        for (let i = 0; i < inSamples && i < buf.length; i++) {
          buf[i]! *= i / Math.max(1, inSamples);
        }
        for (let i = 0; i < outSamples && i < buf.length; i++) {
          const idx = buf.length - 1 - i;
          if (idx < 0) break;
          buf[idx]! *= i / Math.max(1, outSamples);
        }
        break;
      }
      case "audio-eq": {
        const lowDb = Number(fx.params.low ?? 0);
        const midDb = Number(fx.params.mid ?? 0);
        const highDb = Number(fx.params.high ?? 0);
        if (lowDb === 0 && midDb === 0 && highDb === 0) break;
        buf = await applyBiquadEq(buf, sampleRate, lowDb, midDb, highDb);
        break;
      }
      case "audio-noise-gate": {
        buf = applyNoiseGate(
          buf,
          sampleRate,
          Number(fx.params.thresholdDb ?? -45),
          Number(fx.params.rangeDb ?? -40),
          Number(fx.params.attackMs ?? 5),
          Number(fx.params.releaseMs ?? 120),
        );
        break;
      }
      case "audio-spectral-denoise": {
        buf = denoise(buf, sampleRate, {
          strength: Number(fx.params.strength ?? 1),
          floor: Number(fx.params.floor ?? 0.1),
          noiseEstimateMs: Number(fx.params.noiseEstimateMs ?? 250),
        });
        break;
      }
    }
  }
  return buf;
};

// Envelope-following noise gate. A peak follower drives a gain that opens to
// unity above the threshold and closes to `rangeDb` below it, smoothed by the
// attack (opening) and release (closing) time constants.
export const applyNoiseGate = (
  pcm: Float32Array,
  sampleRate: number,
  thresholdDb: number,
  rangeDb: number,
  attackMs: number,
  releaseMs: number,
): Float32Array => {
  const thr = dbToGain(thresholdDb);
  const closedGain = dbToGain(rangeDb);
  const atkCoef = Math.exp(-1 / Math.max(1, (attackMs / 1000) * sampleRate));
  const relCoef = Math.exp(-1 / Math.max(1, (releaseMs / 1000) * sampleRate));
  const out = pcm.slice();
  let env = 0;
  let gain = closedGain;
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(out[i]!);
    // Peak follower: instant attack, exponential release on the detector.
    env = a > env ? a : env * relCoef;
    const target = env >= thr ? 1 : closedGain;
    const coef = target > gain ? atkCoef : relCoef;
    gain = target + (gain - target) * coef;
    out[i] = out[i]! * gain;
  }
  return out;
};

export interface DuckingOptions {
  enabled: boolean;
  amountDb: number;
  thresholdDb: number;
}

// Sums all audio clips into a single mono PCM stream at 48 kHz, applying each
// clip's audio effects. With ducking on, audio-track clips (music) are
// attenuated wherever video-track audio (voice) exceeds the threshold.
export const mixProjectAudio = async (
  project: Project,
  getAsset: (id: ID) => MediaAsset | undefined,
  ducking?: DuckingOptions,
): Promise<{ pcm: Float32Array; sampleRate: number } | null> => {
  const sampleRate = 48_000;
  const totalSamples = Math.ceil((project.timeline.duration / 1000) * sampleRate);
  if (totalSamples <= 0) return null;
  const voiceBus = new Float32Array(totalSamples);
  const musicBus = new Float32Array(totalSamples);
  const ctx = new OfflineAudioContext(1, totalSamples, sampleRate);

  // Which bus a clip belongs to, by its track kind.
  const trackKindOfClip = new Map<string, "video" | "audio" | "other">();
  for (const t of project.timeline.tracks) {
    if (t.muted) continue;
    for (const c of t.clips) {
      trackKindOfClip.set(
        c.id,
        t.kind === "audio" ? "audio" : t.kind === "video" ? "video" : "other",
      );
    }
  }

  const buffers = new Map<string, AudioBuffer>();
  // Solo wins over mute: if any track is soloed, only soloed tracks are heard.
  const soloing = project.timeline.tracks.some((t) => t.solo);
  const audioClips = project.timeline.tracks
    .flatMap((t) => (t.muted || (soloing && !t.solo) ? [] : t.clips))
    .filter((c) => isMediaClip(c) && !c.disabled);

  for (const clip of audioClips) {
    if (!isMediaClip(clip)) continue;
    const asset = getAsset(clip.assetId);
    if (!asset || (asset.kind !== "video" && asset.kind !== "audio")) continue;
    if (!buffers.has(asset.id)) {
      const blob = await readMediaFile(asset.opfsPath);
      if (!blob) continue;
      try {
        const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
        buffers.set(asset.id, decoded);
      } catch {
        // Skip assets that fail to decode.
      }
    }
  }

  for (const clip of audioClips) {
    if (!isMediaClip(clip)) continue;
    const buf = buffers.get(clip.assetId);
    if (!buf) continue;
    const src = buf.getChannelData(0);
    const srcSampleRate = buf.sampleRate;
    const startSample = Math.floor((clip.start / 1000) * sampleRate);
    const inSampleOffset = Math.floor((clip.trimIn / 1000) * srcSampleRate);
    const durSamples = Math.floor((clip.duration / 1000) * sampleRate);

    const slice = new Float32Array(durSamples);
    // Read the source at clip.speed so exported audio tracks the video, which
    // advances source time by speed (see sourceOffsetForRamp in the
    // compositor). Constant-speed clips sync exactly; a speed-ramped clip uses
    // its base speed here — a pitch-correct ramp needs time-stretching, which
    // is a larger, separate change.
    for (let i = 0; i < durSamples; i++) {
      const srcIdx = inSampleOffset + Math.floor((i * srcSampleRate * clip.speed) / sampleRate);
      if (srcIdx < 0 || srcIdx >= src.length) continue;
      slice[i] = src[srcIdx]!;
    }
    const processed = await applyAudioEffects(slice, clip.effects, sampleRate);
    // Apply clip volume — a keyframed "volume" track overrides the static value.
    const volTrack = clip.keyframes.find((k) => k.target === "volume");
    const baseVol = clip.volume ?? 1;
    if (volTrack || baseVol !== 1) {
      for (let i = 0; i < processed.length; i++) {
        const relMs = (i / sampleRate) * 1000;
        const v = volTrack ? sampleKeyframeTrack(volTrack, relMs) ?? baseVol : baseVol;
        processed[i] = processed[i]! * v;
      }
    }
    const bus = trackKindOfClip.get(clip.id) === "audio" ? musicBus : voiceBus;
    for (let i = 0; i < processed.length && startSample + i < bus.length; i++) {
      bus[startSample + i]! += processed[i] ?? 0;
    }
  }

  // Bus combine + ducking + soft limiter run in a Web Worker so the heavy
  // per-sample loops never touch the main thread. We transfer the bus buffers
  // both ways, so there are zero copies despite the boundary crossing.
  const accum = await runCombineWorker({
    voiceBus,
    musicBus,
    sampleRate,
    ...(ducking ? { ducking } : {}),
  });

  return { pcm: accum, sampleRate };
};

// Cached worker — created once on first export and reused across runs.
let mixerWorker: Worker | null = null;
const getWorker = (): Worker | null => {
  if (typeof Worker === "undefined") return null;
  if (mixerWorker) return mixerWorker;
  try {
    mixerWorker = new Worker(new URL("./audio-mixer-worker.ts", import.meta.url), { type: "module" });
    return mixerWorker;
  } catch {
    return null;
  }
};

const runCombineWorker = async (req: {
  voiceBus: Float32Array;
  musicBus: Float32Array;
  sampleRate: number;
  ducking?: { enabled: boolean; amountDb: number; thresholdDb: number };
}): Promise<Float32Array> => {
  const w = getWorker();
  if (!w) {
    // Tests / SSR / browsers without Worker — run inline.
    return combineInline(req);
  }
  return new Promise<Float32Array>((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ pcm: Float32Array }>) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      resolve(e.data.pcm);
    };
    const onError = (err: ErrorEvent) => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
      reject(err.error ?? new Error(err.message));
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage(req, [req.voiceBus.buffer, req.musicBus.buffer]);
  });
};
