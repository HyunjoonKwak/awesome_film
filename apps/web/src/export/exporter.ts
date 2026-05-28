import { type Project, msToFrames, framesToMs } from "@cut/core";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { Compositor } from "@/renderer/compositor";
import { mixProjectAudio } from "./audio-mixer";
import { useDuckingStore } from "./ducking-store";
import { useNormalizeStore } from "./normalize-store";
import { measureLoudness } from "./loudness";
import { useRangeStore } from "@/stores/range-store";
import type { Exporter, ExportPreset, ExportProgress, ExportRequest, ExportResult } from "./types";

const isWebCodecsSupported = (): boolean =>
  typeof window !== "undefined" && "VideoEncoder" in window && "VideoDecoder" in window;

// Renders project frames offscreen via the existing Compositor, encodes each
// frame with WebCodecs VideoEncoder, mixes audio across all unmuted clips,
// and muxes both into an MP4 (H.264 + AAC) or WebM.
export class WebCodecsExporter implements Exporter {
  private cancelled = false;
  cancel(): void {
    this.cancelled = true;
  }

  async start(
    req: ExportRequest,
    onProgress: (p: ExportProgress) => void,
  ): Promise<ExportResult> {
    if (!isWebCodecsSupported()) {
      throw new Error("WebCodecs unavailable in this browser; use the FFmpeg fallback");
    }

    const { project, getAsset } = await this.resolveProject(req.projectId);
    const preset = req.preset;
    // Optional in/out work area limits export to a sub-range of the timeline.
    const range = useRangeStore.getState();
    const rangeStart = range.inMs ?? 0;
    const rangeEnd = range.outMs ?? project.timeline.duration;
    const exportDurationMs = Math.max(1, rangeEnd - rangeStart);
    const totalFrames = Math.max(1, msToFrames(exportDurationMs, preset.fps));

    onProgress({ stage: "preparing", progress: 0 });

    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const compositor = new Compositor(canvas);
    compositor.resize(preset.width, preset.height);
    let virtualPlayheadMs = 0;
    compositor.setPlayheadGetter(() => virtualPlayheadMs);

    const includeAudio =
      preset.container === "mp4" &&
      preset.audioCodec === "aac" &&
      typeof AudioEncoder !== "undefined";

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: codecForMuxer(preset.videoCodec),
        width: preset.width,
        height: preset.height,
        frameRate: preset.fps,
      },
      ...(includeAudio
        ? { audio: { codec: "aac", numberOfChannels: 1, sampleRate: 48_000 } }
        : {}),
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        // eslint-disable-next-line no-console
        console.error("Encoder error:", e);
      },
    });
    encoder.configure({
      codec: codecForEncoder(preset.videoCodec, preset.width, preset.height),
      width: preset.width,
      height: preset.height,
      bitrate: preset.videoBitrateKbps * 1000,
      framerate: preset.fps,
    });

    onProgress({ stage: "rendering", progress: 0 });
    const renderStartedAt = performance.now();

    for (let f = 0; f < totalFrames; f++) {
      if (this.cancelled) {
        encoder.close();
        compositor.dispose();
        throw new Error("Export cancelled");
      }
      virtualPlayheadMs = rangeStart + framesToMs(f, preset.fps);
      // renderFrame keys off project.timeline.playhead for visibility, keyframes
      // and transitions, so advance it per frame (immutably) for the export.
      const frameProject = {
        ...project,
        timeline: { ...project.timeline, playhead: virtualPlayheadMs },
      };
      await compositor.renderFrame(frameProject, getAsset);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((f * 1_000_000) / preset.fps),
        duration: Math.round(1_000_000 / preset.fps),
      });
      try {
        encoder.encode(frame, { keyFrame: f % 60 === 0 });
      } finally {
        frame.close();
      }
      if (f % 5 === 0) {
        const elapsedSec = (performance.now() - renderStartedAt) / 1000;
        const realisedFps = f / Math.max(0.01, elapsedSec);
        const remainingSec = (totalFrames - f) / Math.max(0.5, realisedFps);
        onProgress({
          stage: "rendering",
          progress: f / totalFrames,
          fps: realisedFps,
          etaSeconds: remainingSec,
        });
      }
    }

    if (includeAudio) {
      try {
        const duck = useDuckingStore.getState();
        const mixed = await mixProjectAudio(project, getAsset, {
          enabled: duck.enabled,
          amountDb: duck.amountDb,
          thresholdDb: duck.thresholdDb,
        });
        if (mixed && mixed.pcm.length > 0) {
          // Clip the mix to the export work area when one is set.
          if (range.inMs !== null || range.outMs !== null) {
            const from = Math.floor((rangeStart / 1000) * mixed.sampleRate);
            const to = Math.floor((rangeEnd / 1000) * mixed.sampleRate);
            mixed.pcm = mixed.pcm.slice(Math.max(0, from), Math.min(mixed.pcm.length, to));
          }
          // Loudness normalization: bring integrated LUFS to the target with a
          // single master gain (skip if already silent or on-target).
          const norm = useNormalizeStore.getState();
          if (norm.enabled) {
            const { integratedLufs } = measureLoudness(mixed.pcm, mixed.sampleRate);
            if (Number.isFinite(integratedLufs)) {
              const gain = Math.pow(10, (norm.targetLufs - integratedLufs) / 20);
              if (Math.abs(gain - 1) > 0.01) {
                for (let i = 0; i < mixed.pcm.length; i++) {
                  mixed.pcm[i] = Math.max(-1, Math.min(1, mixed.pcm[i]! * gain));
                }
              }
            }
          }
          const audioEncoder = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
            error: (e) => {
              // eslint-disable-next-line no-console
              console.warn("Audio encoder error:", e);
            },
          });
          audioEncoder.configure({
            codec: "mp4a.40.2",
            sampleRate: mixed.sampleRate,
            numberOfChannels: 1,
            bitrate: preset.audioBitrateKbps * 1000,
          });
          const CHUNK = 1024;
          for (let i = 0; i < mixed.pcm.length; i += CHUNK) {
            const slice = mixed.pcm.slice(i, Math.min(i + CHUNK, mixed.pcm.length));
            const data = new AudioData({
              format: "f32",
              sampleRate: mixed.sampleRate,
              numberOfFrames: slice.length,
              numberOfChannels: 1,
              timestamp: Math.round((i / mixed.sampleRate) * 1_000_000),
              data: slice,
            });
            try {
              audioEncoder.encode(data);
            } finally {
              data.close();
            }
          }
          await audioEncoder.flush();
          audioEncoder.close();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Audio export skipped:", err);
      }
    }

    onProgress({ stage: "muxing", progress: 0.95 });
    await encoder.flush();
    muxer.finalize();
    encoder.close();
    compositor.dispose();

    const { buffer } = muxer.target;
    onProgress({ stage: "finalizing", progress: 1 });

    const name = sanitizeName(project.name) || "export";
    return {
      blob: new Blob([buffer], { type: "video/mp4" }),
      mime: "video/mp4",
      suggestedName: `${name}.mp4`,
    };
  }

  private async resolveProject(_projectId: string): Promise<{
    project: Project;
    getAsset: (id: import("@cut/core").ID) => import("@cut/core").MediaAsset | undefined;
  }> {
    const { useProjectStore } = await import("@/stores/project-store");
    const project = useProjectStore.getState().project;
    const assets = new Map(project.mediaLibrary.map((a) => [a.id, a]));
    return { project, getAsset: (id) => assets.get(id) };
  }
}

const codecForEncoder = (
  codec: ExportPreset["videoCodec"],
  width = 1920,
  height = 1080,
): string => {
  switch (codec) {
    case "h264": {
      const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
      const level = macroblocks > 8192 ? "33" : macroblocks > 5120 ? "2A" : "1F";
      return `avc1.4200${level}`;
    }
    case "vp9":
      return "vp09.00.10.08";
    case "av1":
      return "av01.0.04M.08";
  }
};

const codecForMuxer = (codec: ExportPreset["videoCodec"]): "avc" | "vp9" | "av1" => {
  switch (codec) {
    case "h264":
      return "avc";
    case "vp9":
      return "vp9";
    case "av1":
      return "av1";
  }
};

const sanitizeName = (s: string): string => s.replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 60);

// Saves the encoded blob. In the desktop bundle we route through the
// Electron preload bridge (native Save panel + filesystem write); on the
// web we fall back to the standard anchor-download flow.
export const downloadBlob = async (blob: Blob, filename: string): Promise<void> => {
  const desktop = (
    typeof window !== "undefined"
      ? (window as unknown as { cutDesktop?: { saveExport?: (p: { suggestedName: string; bytes: Uint8Array; mimeType?: string }) => Promise<string | null> } }).cutDesktop
      : undefined
  );
  if (desktop?.saveExport) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await desktop.saveExport({
      suggestedName: filename,
      bytes,
      ...(blob.type ? { mimeType: blob.type } : {}),
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
