import type { ID } from "../utils/id";
import type { Clip } from "./clip";

export type TrackKind = "video" | "audio" | "text" | "overlay";

export interface Track {
  readonly id: ID;
  readonly kind: TrackKind;
  readonly name: string;
  readonly height: number;
  readonly muted: boolean;
  readonly solo: boolean;
  readonly locked: boolean;
  readonly clips: readonly Clip[];
}
