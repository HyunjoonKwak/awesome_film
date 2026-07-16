import { describe, expect, it } from "vitest";
import { normalizeRoomCode, resolveCollabServer } from "../collab-config";

describe("collaboration configuration", () => {
  it("requires an explicitly configured server", () => {
    expect(resolveCollabServer(undefined)).toEqual({ ok: false, error: "missing" });
    expect(resolveCollabServer("  ")).toEqual({ ok: false, error: "missing" });
  });

  it("accepts secure endpoints and local development websocket URLs", () => {
    expect(resolveCollabServer("wss://collab.example.com/socket")).toEqual({
      ok: true,
      url: "wss://collab.example.com/socket",
    });
    expect(resolveCollabServer("ws://localhost:1234")).toEqual({
      ok: true,
      url: "ws://localhost:1234",
    });
  });

  it("rejects insecure remote or non-websocket endpoints", () => {
    expect(resolveCollabServer("ws://collab.example.com")).toEqual({
      ok: false,
      error: "insecure",
    });
    expect(resolveCollabServer("https://collab.example.com")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(resolveCollabServer("wss://user:pass@collab.example.com")).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(resolveCollabServer("wss://collab.example.com?token=secret")).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("normalizes only non-guessable, URL-safe room codes", () => {
    expect(normalizeRoomCode("  cut-12345678  ")).toBe("cut-12345678");
    expect(normalizeRoomCode("short")).toBeNull();
    expect(normalizeRoomCode("room with spaces")).toBeNull();
  });
});
