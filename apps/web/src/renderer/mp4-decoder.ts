// MP4 → encoded chunk → WebCodecs VideoDecoder pipeline. mp4box.js handles
// the box parsing; we hand the resulting samples to VideoDecoder and stash
// the decoded VideoFrames into the shared cache. Only video tracks are
// considered — audio is mixed separately via WebAudio.

// mp4box is loaded on demand — only paid when a video clip is decoded.
import { VideoFrameCache } from "./video-frame-cache";

// mp4box.js ships without TS types we can rely on across versions; describe
// only the surface we touch.
interface MP4Sample {
  cts: number;
  duration: number;
  timescale: number;
  is_sync: boolean;
  data: Uint8Array;
}
interface MP4TrackInfo {
  id: number;
  type: string;
  codec: string;
  video: { width: number; height: number };
}
interface MP4Info {
  duration: number;
  timescale: number;
  tracks: MP4TrackInfo[];
}
interface MP4File {
  onError: (e: string) => void;
  onReady: (info: MP4Info) => void;
  onSamples: (id: number, user: unknown, samples: MP4Sample[]) => void;
  setExtractionOptions: (id: number, user: unknown, opts: { nbSamples: number }) => void;
  start: () => void;
  appendBuffer: (b: ArrayBuffer & { fileStart: number }) => number;
  flush: () => void;
  getTrackById: (id: number) => unknown;
}
type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };

export interface DecoderHandle {
  readonly assetId: string;
  readonly cache: VideoFrameCache;
  readonly duration: number; // microseconds
  readonly width: number;
  readonly height: number;
  close(): void;
}

const isMp4Available = (): boolean =>
  typeof window !== "undefined" && "VideoDecoder" in window;

// Convert a sample into an EncodedVideoChunk in the format the decoder expects.
const sampleToChunk = (sample: MP4Sample): EncodedVideoChunk =>
  new EncodedVideoChunk({
    type: sample.is_sync ? "key" : "delta",
    timestamp: (sample.cts * 1_000_000) / sample.timescale,
    duration: (sample.duration * 1_000_000) / sample.timescale,
    data: sample.data,
  });

// Best-effort `description` builder for AVC/HEVC streams. Some browsers can
// configure the decoder without it; if extraction fails we return undefined
// and rely on the in-band parameter sets in the first key frame.
const description = (file: MP4File, trackId: number): Uint8Array | undefined => {
  try {
    const trak = file.getTrackById(trackId) as {
      mdia?: { minf?: { stbl?: { stsd?: { entries?: { avcC?: unknown; hvcC?: unknown }[] } } } };
    };
    const entry = trak.mdia?.minf?.stbl?.stsd?.entries?.[0];
    const box = entry?.avcC ?? entry?.hvcC;
    if (!box) return undefined;
    const value = (box as { value?: Uint8Array }).value;
    return value instanceof Uint8Array ? value : undefined;
  } catch {
    return undefined;
  }
};

// Decode an entire MP4 (or as much fits in the cache) into VideoFrames keyed
// by the supplied assetId. Returns a handle for cancellation / lookup.
export const decodeMp4ToCache = async (
  blob: Blob,
  assetId: string,
  cache: VideoFrameCache,
): Promise<DecoderHandle | null> => {
  if (!isMp4Available()) return null;
  const arrayBuf = (await blob.arrayBuffer()) as MP4ArrayBuffer;
  arrayBuf.fileStart = 0;

  const MP4Box = await import("mp4box");
  return await new Promise<DecoderHandle | null>((resolve, reject) => {
    const file = (MP4Box as unknown as { createFile: () => MP4File }).createFile();
    let decoder: VideoDecoder | null = null;
    let info: MP4Info | null = null;
    let videoTrack: MP4Info["tracks"][number] | null = null;

    const cleanup = () => {
      try {
        decoder?.close();
      } catch {
        /* ignore */
      }
    };

    file.onError = (e: string) => {
      cleanup();
      reject(new Error(`mp4box error: ${e}`));
    };

    file.onReady = (mp4Info: MP4Info) => {
      info = mp4Info;
      const track = mp4Info.tracks.find((t) => t.type === "video");
      if (!track) {
        cleanup();
        resolve(null);
        return;
      }
      videoTrack = track;

      decoder = new VideoDecoder({
        output: (frame) => cache.store(assetId, frame),
        error: (err) => {
          // eslint-disable-next-line no-console
          console.warn(`VideoDecoder error (${assetId}):`, err);
        },
      });

      const codecString = track.codec;
      try {
        const desc = description(file, track.id);
        const cfg: VideoDecoderConfig = {
          codec: codecString,
          codedWidth: track.video.width,
          codedHeight: track.video.height,
          ...(desc ? { description: desc } : {}),
        };
        decoder.configure(cfg);
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }

      file.setExtractionOptions(track.id, null, { nbSamples: 100 });
      file.start();
    };

    file.onSamples = (_id: number, _user: unknown, samples: MP4Sample[]) => {
      if (!decoder || decoder.state === "closed") return;
      for (const sample of samples) {
        try {
          decoder.decode(sampleToChunk(sample));
        } catch {
          /* ignore single-sample decode errors */
        }
      }
    };

    file.appendBuffer(arrayBuf);
    file.flush();

    // Resolve the handle right away — frames stream into the cache async.
    queueMicrotask(() => {
      if (!info || !videoTrack) {
        resolve(null);
        return;
      }
      resolve({
        assetId,
        cache,
        duration: (info.duration * 1_000_000) / info.timescale,
        width: videoTrack.video.width,
        height: videoTrack.video.height,
        close: cleanup,
      });
    });
  });
};
