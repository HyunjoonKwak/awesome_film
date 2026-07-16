import { newId, type MediaAsset } from "@cut/core";
import { writeMediaFile } from "@/persistence/opfs";
import { probeMedia } from "./probe";
import { makeImageThumb, makeVideoThumb, makeVideoFilmstrip } from "./thumbnail";
import { extractWaveformPeaks } from "./waveform";
import { leaseMediaKey } from "@/persistence/media-gc";

export interface ImportResult {
  asset: MediaAsset;
  releaseLease: () => void;
}

export const importMediaFile = async (file: File): Promise<ImportResult> => {
  const probe = await probeMedia(file);
  const id = newId();
  const opfsPath = `${id}__${file.name}`;
  const releaseLease = leaseMediaKey(opfsPath);
  try {
    await writeMediaFile(opfsPath, file);

    let thumbDataUrl: string | undefined;
    let filmstripDataUrl: string | undefined;
    let filmstripFrames: number | undefined;
    try {
      if (probe.kind === "image") thumbDataUrl = await makeImageThumb(file);
      else if (probe.kind === "video") {
        thumbDataUrl = await makeVideoThumb(file);
        const strip = await makeVideoFilmstrip(file);
        if (strip) {
          filmstripDataUrl = strip.dataUrl;
          filmstripFrames = strip.frames;
        }
      }
    } catch {
      thumbDataUrl = undefined;
    }

    // Extract a peak envelope for audio-bearing media so the timeline can draw
    // a waveform. Images skip this.
    let waveformPeaks: number[] | undefined;
    if (probe.kind === "audio" || probe.kind === "video") {
      const peaks = await extractWaveformPeaks(file);
      if (peaks) waveformPeaks = peaks;
    }

    const asset: MediaAsset = {
      id,
      name: file.name,
      kind: probe.kind,
      mime: probe.mime,
      durationMs: probe.durationMs,
      ...(probe.width !== undefined ? { width: probe.width } : {}),
      ...(probe.height !== undefined ? { height: probe.height } : {}),
      opfsPath,
      sizeBytes: file.size,
      ...(thumbDataUrl ? { thumbDataUrl } : {}),
      ...(filmstripDataUrl ? { filmstripDataUrl } : {}),
      ...(filmstripFrames !== undefined ? { filmstripFrames } : {}),
      ...(waveformPeaks ? { waveformPeaks } : {}),
      importedAt: Date.now(),
    };

    return { asset, releaseLease };
  } catch (error) {
    releaseLease();
    throw error;
  }
};
