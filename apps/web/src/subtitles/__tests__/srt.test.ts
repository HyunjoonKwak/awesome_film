import { describe, expect, it } from "vitest";
import { parseSrt, parseVtt, toSrt, toVtt } from "../srt";

const sampleSrt = `1
00:00:00,500 --> 00:00:02,000
Hello world

2
00:00:02,500 --> 00:00:04,750
Second line
with two rows
`;

describe("srt / vtt", () => {
  it("parses SRT cues", () => {
    const cues = parseSrt(sampleSrt);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 500, end: 2000, text: "Hello world" });
    expect(cues[1]!.text).toBe("Second line\nwith two rows");
  });

  it("round-trips SRT", () => {
    const cues = parseSrt(sampleSrt);
    const out = toSrt(cues);
    const reparsed = parseSrt(out);
    expect(reparsed).toEqual(cues);
  });

  it("parses and writes VTT", () => {
    const cues = parseSrt(sampleSrt);
    const vtt = toVtt(cues);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    const reparsed = parseVtt(vtt);
    expect(reparsed).toEqual(cues);
  });
});
