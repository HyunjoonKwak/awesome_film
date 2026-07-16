import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { signCollabTicket } from "./collab-auth.mjs";
import { createCollabRelay } from "./collab-relay.mjs";

const handshakeStatus = (url, origin) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin });
    let settled = false;
    socket.once("open", () => {
      settled = true;
      resolve({ socket, status: 101 });
    });
    socket.once("unexpected-response", (_request, response) => {
      settled = true;
      response.resume();
      resolve({ socket, status: response.statusCode });
    });
    socket.on("error", (error) => {
      if (!settled) reject(error);
    });
  });

test("relay accepts a valid room ticket and rejects an untrusted origin", async () => {
  const secret = "test-secret-with-at-least-32-characters";
  const room = "cut-editor:room-12345678";
  assert.throws(
    () =>
      createCollabRelay({
        secret,
        allowedOrigins: ["https://editor.example.com"],
        maxConnections: Number.NaN,
      }),
    /COLLAB_MAX_CONNECTIONS/,
  );
  const relay = createCollabRelay({
    port: 0,
    secret,
    allowedOrigins: ["https://editor.example.com"],
  });
  const address = await relay.listen();
  assert.equal(typeof address, "object");
  const token = signCollabTicket({ room, expiresAt: Math.floor(Date.now() / 1000) + 60 }, secret);
  const url = `ws://127.0.0.1:${address.port}/${room}?token=${encodeURIComponent(token)}`;

  try {
    const accepted = await handshakeStatus(url, "https://editor.example.com");
    assert.equal(accepted.status, 101);
    accepted.socket.close();
    await new Promise((resolve) => accepted.socket.once("close", resolve));

    const rejected = await handshakeStatus(url, "https://attacker.example.com");
    assert.equal(rejected.status, 401);

    const invalidTicket = await handshakeStatus(
      `ws://127.0.0.1:${address.port}/${room}?token=invalid`,
      "https://editor.example.com",
    );
    assert.equal(invalidTicket.status, 401);
  } finally {
    await relay.close();
  }
});
