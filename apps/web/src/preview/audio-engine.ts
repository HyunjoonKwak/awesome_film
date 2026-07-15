import type { MediaAsset, Project } from "@cut/core";
import { isMediaClip } from "@cut/core";
import { readMediaFile } from "@/persistence/opfs";

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
    const ctx = this.getCtx();
    await ctx.resume();

    const base = ctx.currentTime + 0.05; // small lead so scheduling isn't late
    const soloing = project.timeline.tracks.some((t) => t.solo);

    for (const track of project.timeline.tracks) {
      if (track.muted || (soloing && !track.solo)) continue;
      for (const clip of track.clips) {
        if (!isMediaClip(clip) || clip.disabled) continue;
        const asset = project.mediaLibrary.find((a) => a.id === clip.assetId);
        if (!asset || (asset.kind !== "audio" && asset.kind !== "video")) continue;

        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= fromMs) continue; // already past this clip

        const buffer = await this.bufferFor(asset);
        if (!buffer) continue;

        // Timeline position where this clip's playback begins.
        const tlStart = Math.max(clip.start, fromMs);
        // Source offset honours trim + how far into the clip we start, scaled
        // by clip speed (matches the video's sourceOffset math).
        const srcOffsetSec = clip.trimIn / 1000 + ((tlStart - clip.start) / 1000) * clip.speed;
        // When to fire, in context time: timeline gap divided by rate.
        const when = base + (tlStart - fromMs) / 1000 / rate;
        // How much source to consume (buffer-time, before playbackRate).
        const srcDurSec = ((clipEnd - tlStart) / 1000) * clip.speed;

        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = clip.speed * rate;
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
