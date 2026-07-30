import { clipEnd } from "../model/clip";
import type { Track } from "../model/track";
import type { ID } from "../utils/id";
import type { Ms } from "../utils/time";

// Which clips a rubber-band selection covers. The caller resolves the pixel
// rectangle into a set of track ids (vertical hit) and a time span (horizontal
// hit); this decides the intersection. Split out from the panel's pointer
// handlers because that half needs a DOM and this half is the part worth
// testing — the interval comparison is easy to get subtly wrong at the edges.
//
// Overlap is half-open at both ends, so a band that stops exactly on a clip's
// boundary leaves it alone rather than surprising the user with a neighbour
// they never covered. A zero-width band still matches a clip that spans the
// instant — the caller is expected to ignore a drag that never moved, which is
// where "Cmd+click selects nothing" comes from.
export const clipIdsInMarquee = (
  tracks: readonly Track[],
  trackIds: ReadonlySet<ID>,
  from: Ms,
  to: Ms,
): readonly ID[] => {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const out: ID[] = [];
  for (const track of tracks) {
    if (!trackIds.has(track.id)) continue;
    for (const clip of track.clips) {
      if (clip.start < hi && clipEnd(clip) > lo) out.push(clip.id);
    }
  }
  return out;
};
