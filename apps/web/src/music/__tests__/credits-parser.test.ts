import { describe, expect, it } from "vitest";
import { parseYoutubeCredits } from "../credits-parser";

describe("parseYoutubeCredits", () => {
  it("parses the English YouTube auto-credit block", () => {
    const text = `
Music in this video
Learn more
Listen ad-free with YouTube Premium
Song
Fly Away
Artist
TheFatRat
Album
Fly Away (The Remixes)
Licensed to YouTube by
[Merlin] Believe Music (on behalf of TheFatRat); BMI
`;

    const credits = parseYoutubeCredits(text);

    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      song: "Fly Away",
      artist: "TheFatRat",
      album: "Fly Away (The Remixes)",
      licenseGuess: "paid",
    });
    expect(credits[0]!.licensedBy).toContain("Believe Music");
  });

  it("parses the Korean YouTube auto-credit block", () => {
    const text = `
이 동영상에 사용된 음악
자세히 알아보기
노래
바람이 분다
아티스트
이소라
YouTube 라이선스 제공업체
NoCopyrightSounds
`;

    const credits = parseYoutubeCredits(text);

    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      song: "바람이 분다",
      artist: "이소라",
      licenseGuess: "free",
    });
  });

  it("parses colon-style manual credits with Artist - Title", () => {
    const text = `
Thanks for watching!
Music: Kevin MacLeod - Monkeys Spinning Monkeys
License: Creative Commons Attribution 4.0
`;

    const credits = parseYoutubeCredits(text);

    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({
      song: "Monkeys Spinning Monkeys",
      artist: "Kevin MacLeod",
      licenseGuess: "free",
    });
  });

  it("splits multiple songs into separate credits", () => {
    const text = `
Song
First Track
Artist
Artist One
Song
Second Track
Artist
Artist Two
`;

    const credits = parseYoutubeCredits(text);

    expect(credits).toHaveLength(2);
    expect(credits[0]!.song).toBe("First Track");
    expect(credits[1]!.song).toBe("Second Track");
    expect(credits[1]!.artist).toBe("Artist Two");
  });

  it("returns an empty list for text without credits", () => {
    expect(parseYoutubeCredits("오늘 브이로그 봐주셔서 감사합니다!")).toEqual([]);
    expect(parseYoutubeCredits("")).toEqual([]);
  });

  it("guesses unknown when the licensor is not a known marker", () => {
    const text = `
Song
Mystery
Artist
Someone
Licensed to YouTube by
Some Indie Label
`;

    expect(parseYoutubeCredits(text)[0]!.licenseGuess).toBe("unknown");
  });

  it("keeps hyphenated block-style titles intact (no Artist - Title split)", () => {
    const text = "Song\nFly Away - Radio Edit\nArtist\nTheFatRat";

    expect(parseYoutubeCredits(text)[0]).toMatchObject({
      song: "Fly Away - Radio Edit",
      artist: "TheFatRat",
    });
  });

  it("rejects links and timecodes masquerading as credit values", () => {
    expect(parseYoutubeCredits("Music: https://youtu.be/abc123")).toEqual([]);
    expect(parseYoutubeCredits("Music: 0:30 the good part")).toEqual([]);
  });

  it("does not let a broad label absorb ordinary block text", () => {
    expect(parseYoutubeCredits("music\nby the sea we walked")).toEqual([]);
  });

  it("never leaks a later licensor onto an earlier credit", () => {
    const text = `
Song
Free One
Artist
A
Song
Paid One
Artist
B
Licensed to YouTube by
Epidemic Sound
`;

    const credits = parseYoutubeCredits(text);

    expect(credits).toHaveLength(2);
    expect(credits[0]!.licenseGuess).toBe("unknown");
    expect(credits[1]!.licenseGuess).toBe("paid");
  });
});
