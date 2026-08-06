import { describe, expect, it } from "vitest";
import { toFreeTrack } from "../openverse";

const raw = {
  id: "eb3c20b6",
  title: "Calm Synthesizer",
  creator: "InspectorJ",
  url: "https://cdn.freesound.org/previews/361/361529_5121236-hq.mp3",
  foreign_landing_url: "https://freesound.org/people/InspectorJ/sounds/361529",
  license: "by",
  duration: 62_000,
};

describe("toFreeTrack", () => {
  it("maps a valid Openverse result", () => {
    const track = toFreeTrack(raw);

    expect(track).toMatchObject({
      id: "eb3c20b6",
      title: "Calm Synthesizer",
      creator: "InspectorJ",
      audioUrl: raw.url,
      landingUrl: raw.foreign_landing_url,
      license: "by",
      durationMs: 62_000,
    });
  });

  it("rejects results without a playable https url", () => {
    expect(toFreeTrack({ ...raw, url: undefined })).toBeNull();
    expect(toFreeTrack({ ...raw, url: "ftp://example.com/x.mp3" })).toBeNull();
    expect(toFreeTrack({ ...raw, url: "javascript:alert(1)" })).toBeNull();
  });

  it("rejects results missing title or id and tolerates missing duration", () => {
    expect(toFreeTrack({ ...raw, title: "" })).toBeNull();
    expect(toFreeTrack({ ...raw, id: undefined })).toBeNull();
    expect(toFreeTrack({ ...raw, duration: undefined })?.durationMs).toBeNull();
    expect(toFreeTrack("garbage")).toBeNull();
  });
});
