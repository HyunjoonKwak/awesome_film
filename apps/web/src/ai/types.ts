import type { ID, Ms, MediaAsset } from "@cut/core";

export interface Subtitle {
  readonly start: Ms;
  readonly end: Ms;
  readonly text: string;
  readonly lang?: string;
  readonly confidence?: number;
}

export interface Range {
  readonly start: Ms;
  readonly end: Ms;
}

export interface SceneCut {
  readonly atMs: Ms;
  readonly score: number;
}

export interface AiTask<TResult> {
  readonly id: ID;
  readonly label: string;
  readonly onProgress: (cb: (p: number) => void) => () => void;
  readonly result: Promise<TResult>;
  readonly cancel: () => void;
}

export interface SilenceOpts {
  readonly thresholdDb?: number;     // default -45
  readonly minSilenceMs?: number;    // default 400
  readonly paddingMs?: number;       // keep this much around speech
}

export interface AiProvider {
  readonly name: string;
  transcribe(asset: MediaAsset, opts?: { lang?: string }): AiTask<readonly Subtitle[]>;
  detectSilence(asset: MediaAsset, opts?: SilenceOpts): AiTask<readonly Range[]>;
  detectScenes(asset: MediaAsset): AiTask<readonly SceneCut[]>;
}
