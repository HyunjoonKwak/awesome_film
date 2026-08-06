import { detectBeatsFromBlob } from "@/ai/beat-detect";
import { estimateBpm } from "@/autoedit/music";

// One-shot BPM analysis for a music file — reuses the beat detector the
// auto-edit pipeline already ships. Browser-only (WebAudio decode).
export const estimateTrackBpm = async (blob: Blob): Promise<number | null> => {
  try {
    const beats = await detectBeatsFromBlob(blob);
    const bpm = estimateBpm(beats);
    return bpm > 0 ? bpm : null;
  } catch {
    return null;
  }
};
