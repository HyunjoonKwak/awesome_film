import { describe, expect, it } from "vitest";
import { readAudioTags } from "../id3";

const latin1 = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

// Minimal ID3v2.3 tag: 10-byte header + text frames (encoding byte 0 = latin1).
const id3v2 = (frames: readonly { id: string; text: string }[]) => {
  const frameBytes = frames.flatMap(({ id, text }) => {
    const content = [0, ...latin1(text)]; // encoding 0 + text
    const size = content.length;
    return [
      ...latin1(id),
      (size >> 24) & 0xff,
      (size >> 16) & 0xff,
      (size >> 8) & 0xff,
      size & 0xff,
      0,
      0,
      ...content,
    ];
  });
  const size = frameBytes.length;
  // syncsafe 28-bit size
  const header = [
    ...latin1("ID3"),
    3,
    0,
    0,
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ];
  return new Uint8Array([...header, ...frameBytes]);
};

const id3v1Tail = (title: string, artist: string) => {
  const tail = new Uint8Array(128);
  tail.set(latin1("TAG"), 0);
  tail.set(latin1(title.slice(0, 30)), 3);
  tail.set(latin1(artist.slice(0, 30)), 33);
  return tail;
};

describe("readAudioTags", () => {
  it("reads title and artist from ID3v2.3 text frames", async () => {
    const blob = new Blob([
      id3v2([
        { id: "TIT2", text: "Fly Away" },
        { id: "TPE1", text: "TheFatRat" },
      ]),
      new Uint8Array(64), // fake audio payload
    ]);

    expect(await readAudioTags(blob)).toEqual({ title: "Fly Away", artist: "TheFatRat" });
  });

  it("decodes UTF-8 frames (encoding byte 3)", async () => {
    const utf8 = new TextEncoder().encode("바람이 분다");
    const content = [3, ...utf8];
    const frame = [...latin1("TIT2"), 0, 0, 0, content.length, 0, 0, ...content];
    const size = frame.length;
    const tag = new Uint8Array([
      ...latin1("ID3"),
      3,
      0,
      0,
      (size >> 21) & 0x7f,
      (size >> 14) & 0x7f,
      (size >> 7) & 0x7f,
      size & 0x7f,
      ...frame,
    ]);

    expect((await readAudioTags(new Blob([tag]))).title).toBe("바람이 분다");
  });

  it("falls back to the ID3v1 tail when no v2 tag exists", async () => {
    const blob = new Blob([new Uint8Array(256), id3v1Tail("Old Song", "Old Artist")]);

    expect(await readAudioTags(blob)).toEqual({ title: "Old Song", artist: "Old Artist" });
  });

  it("returns empty tags for untagged audio", async () => {
    expect(await readAudioTags(new Blob([new Uint8Array(300)]))).toEqual({});
  });

  it("finds the title even after a huge album-art frame", async () => {
    const art = { id: "APIC", text: "x".repeat(200_000) };
    const blob = new Blob([id3v2([art, { id: "TIT2", text: "Buried Title" }])]);

    expect((await readAudioTags(blob)).title).toBe("Buried Title");
  });

  it("decodes CP949 bytes hiding behind the latin1 flag", async () => {
    // "바람" in EUC-KR
    const content = [0, 0xb9, 0xd9, 0xb6, 0xf7];
    const frame = [...latin1("TIT2"), 0, 0, 0, content.length, 0, 0, ...content];
    const size = frame.length;
    const tag = new Uint8Array([
      ...latin1("ID3"),
      3,
      0,
      0,
      (size >> 21) & 0x7f,
      (size >> 14) & 0x7f,
      (size >> 7) & 0x7f,
      size & 0x7f,
      ...frame,
    ]);

    expect((await readAudioTags(new Blob([tag]))).title).toBe("바람");
  });

  it("reads v2.4 syncsafe frame sizes", async () => {
    const text = [0, ...latin1("Syncsafe Song")];
    const frame = [
      ...latin1("TIT2"),
      (text.length >> 21) & 0x7f,
      (text.length >> 14) & 0x7f,
      (text.length >> 7) & 0x7f,
      text.length & 0x7f,
      0,
      0,
      ...text,
    ];
    const size = frame.length;
    const tag = new Uint8Array([
      ...latin1("ID3"),
      4,
      0,
      0,
      (size >> 21) & 0x7f,
      (size >> 14) & 0x7f,
      (size >> 7) & 0x7f,
      size & 0x7f,
      ...frame,
    ]);

    expect((await readAudioTags(new Blob([tag]))).title).toBe("Syncsafe Song");
  });

  it("merges a partial v2 tag with the v1 tail", async () => {
    const blob = new Blob([
      id3v2([{ id: "TIT2", text: "V2 Title" }]),
      new Uint8Array(64),
      id3v1Tail("ignored", "V1 Artist"),
    ]);

    expect(await readAudioTags(blob)).toEqual({ title: "V2 Title", artist: "V1 Artist" });
  });
});
