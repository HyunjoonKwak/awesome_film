import { readMediaFile } from "@/persistence/opfs";
import type { MediaAsset, Project } from "@cut/core";
import { hasSpeedRamp, isMediaClip, sampleKeyframeTrack, sourceOffsetForRamp } from "@cut/core";

// Live audio monitoring for preview playback. On play we schedule every
// audible media clip from the current playhead onward against the
// AudioContext clock; the preview's rAF loop advances the playhead by the
// same wall-clock, so picture and sound stay in step. Constant-speed clips
// play at the right pitch/rate; reverse (rate < 0) and per-clip scrubbing are
// out of scope here. Export keeps its own offline mixer — this is monitoring
// only.
class AudioEngine {
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private active: AudioBufferSourceNode[] = [];
  private generation = 0;
  private transportPlayhead = 0;
  private transportStartedAt = 0;
  private transportRate = 1;
  private transportActive = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private async bufferFor(asset: MediaAsset): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(asset.id);
    if (cached) return cached;
    const blob = await readMediaFile(asset.opfsPath);
    if (!blob) return null;
    try {
      const decoded = await this.getCtx().decodeAudioData(await blob.arrayBuffer());
      this.buffers.set(asset.id, decoded);
      return decoded;
    } catch {
      return null; // silent/undecodable asset — skip
    }
  }

  // Schedule audio from `fromMs` onward at global `rate`. Stops anything
  // already playing first, so it doubles as the re-schedule on seek/rate.
  async play(project: Project, fromMs: number, rate: number): Promise<void> {
    this.stop();
    if (rate <= 0) return; // reverse playback has no monitoring path
    const generation = this.generation;
    const requestedAt = performance.now();
    this.transportPlayhead = fromMs;
    this.transportStartedAt = requestedAt;
    this.transportRate = rate;
    this.transportActive = true;
    const ctx = this.getCtx();
    await ctx.resume();
    if (generation !== this.generation) return;

    const soloing = project.timeline.tracks.some((t) => t.solo);
    const audibleAssets = new Map<string, MediaAsset>();
    for (const track of project.timeline.tracks) {
      if (track.muted || (soloing && !track.solo)) continue;
      for (const clip of track.clips) {
        if (!isMediaClip(clip) || clip.disabled || clip.start + clip.duration <= fromMs) continue;
        const asset = project.mediaLibrary.find((candidate) => candidate.id === clip.assetId);
        if (asset && (asset.kind === "audio" || asset.kind === "video")) {
          audibleAssets.set(asset.id, asset);
        }
      }
    }
    // Decode in parallel before choosing the AudioContext start time. Capturing
    // `base` before these awaits made audio start late but from the old offset.
    await Promise.all([...audibleAssets.values()].map((asset) => this.bufferFor(asset)));
    if (generation !== this.generation) return;

    const elapsedMs = performance.now() - requestedAt;
    const effectiveFromMs = fromMs + elapsedMs * rate;
    const leadSeconds = 0.03;
    const base = ctx.currentTime + leadSeconds;
    this.transportPlayhead = effectiveFromMs;
    this.transportStartedAt = performance.now() + leadSeconds * 1000;

    for (const track of project.timeline.tracks) {
      if (track.muted || (soloing && !track.solo)) continue;
      for (const clip of track.clips) {
        if (!isMediaClip(clip) || clip.disabled) continue;
        if (clip.speed <= 0) continue; // Web Audio has no reverse BufferSource playback
        const asset = project.mediaLibrary.find((a) => a.id === clip.assetId);
        if (!asset || (asset.kind !== "audio" && asset.kind !== "video")) continue;

        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= effectiveFromMs) continue; // already past this clip

        const buffer = this.buffers.get(asset.id) ?? null;
        if (!buffer) continue;

        // Timeline position where this clip's playback begins.
        const tlStart = Math.max(clip.start, effectiveFromMs);
        // Source offset honours trim + how far into the clip we start, scaled
        // by clip speed (matches the video's sourceOffset math).
        const clipRelStart = tlStart - clip.start;
        const srcOffsetMs = sourceOffsetForRamp(clip, clipRelStart);
        const srcOffsetSec = (clip.trimIn + srcOffsetMs) / 1000;
        // When to fire, in context time: timeline gap divided by rate.
        const when = base + (tlStart - effectiveFromMs) / 1000 / rate;
        // How much source to consume (buffer-time, before playbackRate).
        const srcDurSec = (sourceOffsetForRamp(clip, clip.duration) - srcOffsetMs) / 1000;

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        if (hasSpeedRamp(clip)) {
          const speedTrack = clip.keyframes.find((track) => track.target === "speed");
          const timelineDurationMs = clipEnd - tlStart;
          const curveDurationSec = timelineDurationMs / 1000 / rate;
          // Bound automation size while keeping enough samples for smooth
          // ramps. The same keyframe sampler/easing drives video mapping.
          const samples = Math.max(2, Math.min(256, Math.ceil(timelineDurationMs / 40) + 1));
          const curve = new Float32Array(samples);
          for (let i = 0; i < samples; i++) {
            const relMs = clipRelStart + (i / (samples - 1)) * timelineDurationMs;
            curve[i] =
              Math.max(
                0.05,
                speedTrack ? (sampleKeyframeTrack(speedTrack, relMs) ?? clip.speed) : clip.speed,
              ) * rate;
          }
          src.playbackRate.setValueCurveAtTime(curve, when, Math.max(0.001, curveDurationSec));
        } else {
          src.playbackRate.value = clip.speed * rate;
        }
        const gain = ctx.createGain();
        gain.gain.value = clip.volume ?? 1;
        src.connect(gain).connect(ctx.destination);
        try {
          src.start(when, Math.max(0, srcOffsetSec), Math.max(0, srcDurSec));
        } catch {
          continue; // start() throws if params are out of range — skip clip
        }
        this.active.push(src);
      }
    }
  }

  stop(): void {
    this.generation++;
    this.transportActive = false;
    for (const src of this.active) {
      try {
        src.stop();
      } catch {
        // already stopped/ended
      }
      src.disconnect();
    }
    this.active = [];
  }

  // Used by the store bridge to distinguish normal rAF playhead updates from
  // an explicit seek while playback is running.
  isTransportDrifted(playheadMs: number, rate: number, toleranceMs = 120): boolean {
    if (!this.transportActive || rate !== this.transportRate) return false;
    const expected =
      this.transportPlayhead + Math.max(0, performance.now() - this.transportStartedAt) * rate;
    return Math.abs(playheadMs - expected) > Math.max(toleranceMs, Math.abs(rate) * 50);
  }

  // Drop a cached decode when its asset is removed/replaced.
  forget(assetId: string): void {
    this.buffers.delete(assetId);
  }
}

let singleton: AudioEngine | null = null;

export const getAudioEngine = (): AudioEngine => {
  if (!singleton) singleton = new AudioEngine();
  return singleton;
};
