// Minimal ID3 tag reader — enough to pull title/artist out of the user's
// own audio files when registering them in the music library. Supports
// ID3v2.2/2.3/2.4 text frames and the ID3v1 tail as a fallback. Runs
// entirely locally; no fingerprinting services involved.

export interface AudioTags {
  readonly title?: string;
  readonly artist?: string;
}

const MAX_TAG_BYTES = 4 * 1024 * 1024; // album art can push tags into the MBs
const MAX_TEXT = 200;

const syncsafe = (b: Uint8Array, at: number): number =>
  ((b[at]! & 0x7f) << 21) |
  ((b[at + 1]! & 0x7f) << 14) |
  ((b[at + 2]! & 0x7f) << 7) |
  (b[at + 3]! & 0x7f);

const uint32 = (b: Uint8Array, at: number): number =>
  (b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!;

const ascii = (b: Uint8Array, at: number, len: number): string =>
  String.fromCharCode(...b.subarray(at, at + len));

const stripNulls = (s: string): string => s.split("\u0000")[0]!.trim().slice(0, MAX_TEXT);

const decodeWith = (label: string, body: Uint8Array): string => {
  try {
    return stripNulls(new TextDecoder(label).decode(body));
  } catch {
    return "";
  }
};

// Legacy single-byte text: the spec says latin1, but Korean rips very
// commonly stuff CP949 bytes behind the latin1 flag. When high bytes are
// present, prefer an euc-kr reading that decodes cleanly.
const decodeLegacy = (body: Uint8Array): string => {
  if (body.some((b) => b >= 0x80)) {
    const kr = decodeWith("euc-kr", body);
    if (kr && !kr.includes("�")) return kr;
  }
  return decodeWith("latin1", body);
};

// Text frame payload: first byte selects the encoding.
const decodeText = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return "";
  const enc = bytes[0]!;
  const body = bytes.subarray(1);
  if (enc === 1) {
    // UTF-16 with BOM
    if (body.length >= 2 && body[0] === 0xff && body[1] === 0xfe) {
      return decodeWith("utf-16le", body.subarray(2));
    }
    if (body.length >= 2 && body[0] === 0xfe && body[1] === 0xff) {
      return decodeWith("utf-16be", body.subarray(2));
    }
    return decodeWith("utf-16le", body);
  }
  if (enc === 2) return decodeWith("utf-16be", body);
  if (enc === 3) return decodeWith("utf-8", body);
  return decodeLegacy(body);
};

const parseId3v2 = (head: Uint8Array): AudioTags => {
  if (head.length < 10 || ascii(head, 0, 3) !== "ID3") return {};
  const version = head[3]!;
  const flags = head[5]!;
  const tagSize = syncsafe(head, 6);
  const end = Math.min(head.length, 10 + tagSize);
  const v22 = version === 2;
  const idLen = v22 ? 3 : 4;
  const headerLen = v22 ? 6 : 10;
  const titleId = v22 ? "TT2" : "TIT2";
  const artistId = v22 ? "TP1" : "TPE1";
  let title: string | undefined;
  let artist: string | undefined;
  let at = 10;
  // Skip the extended header when flagged (v2.3: 4-byte size excluding
  // itself; v2.4: syncsafe size including the whole header).
  if (!v22 && (flags & 0x40) !== 0 && at + 4 <= end) {
    at += version === 4 ? syncsafe(head, at) : 4 + uint32(head, at);
  }
  while (at + headerLen <= end) {
    const id = ascii(head, at, idLen);
    if (!/^[A-Z0-9]+$/.test(id)) break; // zero padding → done
    const size = v22
      ? (head[at + 3]! << 16) | (head[at + 4]! << 8) | head[at + 5]!
      : version === 4
        ? syncsafe(head, at + idLen)
        : uint32(head, at + idLen);
    if (size <= 0 || at + headerLen + size > end) break;
    const payload = head.subarray(at + headerLen, at + headerLen + size);
    if (id === titleId) title = decodeText(payload) || undefined;
    if (id === artistId) artist = decodeText(payload) || undefined;
    if (title && artist) break;
    at += headerLen + size;
  }
  return { ...(title ? { title } : {}), ...(artist ? { artist } : {}) };
};

const parseId3v1 = (tail: Uint8Array): AudioTags => {
  if (tail.length < 128 || ascii(tail, 0, 3) !== "TAG") return {};
  const title = stripNulls(decodeLegacy(tail.subarray(3, 33)));
  const artist = stripNulls(decodeLegacy(tail.subarray(33, 63)));
  return { ...(title ? { title } : {}), ...(artist ? { artist } : {}) };
};

export const readAudioTags = async (blob: Blob): Promise<AudioTags> => {
  try {
    // Read the header first, then exactly the declared tag size — a 200KB
    // album-art frame ahead of TIT2 must not push the title out of a
    // fixed-size window.
    const header = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
    const declared =
      header.length >= 10 && ascii(header, 0, 3) === "ID3" ? 10 + syncsafe(header, 6) : 0;
    const window = Math.min(Math.max(declared, 1024), MAX_TAG_BYTES);
    const head = new Uint8Array(await blob.slice(0, window).arrayBuffer());
    const v2 = parseId3v2(head);
    let v1: AudioTags = {};
    if ((!v2.title || !v2.artist) && blob.size >= 128) {
      v1 = parseId3v1(new Uint8Array(await blob.slice(blob.size - 128).arrayBuffer()));
    }
    // Field-level merge: a v2 tag carrying only the title still gets the
    // artist from the v1 tail.
    const title = v2.title ?? v1.title;
    const artist = v2.artist ?? v1.artist;
    return { ...(title ? { title } : {}), ...(artist ? { artist } : {}) };
  } catch {
    return {};
  }
};
