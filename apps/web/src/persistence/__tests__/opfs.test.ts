import { afterEach, describe, expect, it } from "vitest";
import { createMediaFileWriter, deleteMediaFile, readMediaFile } from "../opfs";

const keys: string[] = [];

afterEach(async () => {
  await Promise.all(keys.splice(0).map((key) => deleteMediaFile(key)));
});

describe("incremental media writer", () => {
  it("stores sequential chunks without requiring a complete File", async () => {
    const key = `stream-${crypto.randomUUID()}`;
    keys.push(key);
    const writer = await createMediaFileWriter(key, "video/test");

    await writer.write(0, new Uint8Array([1, 2, 3]));
    await writer.write(3, new Uint8Array([4, 5]));
    await writer.close();

    const result = await readMediaFile(key);
    expect(result?.type).toBe("video/test");
    if (!result) throw new Error("Written media is missing");
    expect([...new Uint8Array(await result.arrayBuffer())]).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects out-of-order chunks and discards aborted transfers", async () => {
    const key = `stream-${crypto.randomUUID()}`;
    keys.push(key);
    const writer = await createMediaFileWriter(key, "video/test");

    await expect(writer.write(3, new Uint8Array([1]))).rejects.toThrow("sequentially");
    await writer.abort();

    expect(await readMediaFile(key)).toBeNull();
  });
});
