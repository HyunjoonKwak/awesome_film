import type { ID } from "../utils/id";
import type { Ms } from "../utils/time";

// A named point (or short range) on the timeline. Drives chapter export,
// scene navigation, and review notes.
export interface Marker {
  readonly id: ID;
  readonly at: Ms;
  readonly endMs?: Ms;     // optional range
  readonly label: string;
  readonly color: string;  // hex, displayed on the ruler
}
