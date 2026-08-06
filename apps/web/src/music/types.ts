import type { ID } from "@cut/core";

// A saved music reference — a track the user heard somewhere (usually a
// YouTube video) and wants to reuse later. Lives in the app-level library
// (persisted across projects), NOT inside any project file.
export type MusicLicense = "free" | "paid" | "unknown";

export interface MusicRef {
  readonly id: ID;
  readonly title: string;
  readonly artist?: string;
  readonly license: MusicLicense;
  readonly sourceUrl?: string; // official page / legitimate download source
  readonly youtubeUrl?: string; // the video where the user heard it
  readonly youtubeTitle?: string; // fetched video title — usage context
  readonly moods: readonly string[]; // 잔잔한, 신나는, 웅장한 …
  readonly scenes: readonly string[]; // 오프닝, 여행, 하이라이트 …
  readonly note?: string; // which scene / what feel it was used for
  readonly assetId?: ID; // linked audio asset in the media bin (ready to use)
  readonly addedAt: number;
}
