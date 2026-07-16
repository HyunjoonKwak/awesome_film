import { describe, expect, it } from "vitest";
import { decodedStereoChannels, packStereoPlanar } from "../audio-mixer";
import { combineInline } from "../audio-mixer-worker";

describe("stereo audio mixing", () => {
  it("keeps left and right buses independent", () => {
    const channels = combineInline({
      voiceChannels: [Float32Array.of(0.2, 0), Float32Array.of(0, 0.4)],
      musicChannels: [Float32Array.of(0.1, 0), Float32Array.of(0, 0.2)],
      sampleRate: 48_000,
    });

    expect([...channels[0]]).toEqual([expect.closeTo(0.3), 0]);
    expect([...channels[1]]).toEqual([0, expect.closeTo(0.6)]);
  });

  it("duplicates mono sources but preserves decoded stereo sources", () => {
    const left = Float32Array.of(1, 2);
    const right = Float32Array.of(3, 4);
    const mono = decodedStereoChannels({
      numberOfChannels: 1,
      getChannelData: () => left,
    });
    const stereo = decodedStereoChannels({
      numberOfChannels: 2,
      getChannelData: (channel) => (channel === 0 ? left : right),
    });

    expect(mono).toEqual([left, left]);
    expect(stereo).toEqual([left, right]);
  });

  it("uses one limiter gain for both channels", () => {
    const channels = combineInline({
      voiceChannels: [Float32Array.of(2), Float32Array.of(0.5)],
      musicChannels: [Float32Array.of(0), Float32Array.of(0)],
      sampleRate: 48_000,
    });

    expect([...channels[0]]).toEqual([1]);
    expect([...channels[1]]).toEqual([0.25]);
  });

  it("packs planar encoder input as all left frames followed by all right frames", () => {
    const channels: [Float32Array, Float32Array] = [
      Float32Array.of(1, 2, 3),
      Float32Array.of(4, 5, 6),
    ];

    expect([...packStereoPlanar(channels, 1, 2)]).toEqual([2, 3, 5, 6]);
  });
});
