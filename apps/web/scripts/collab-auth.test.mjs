import assert from "node:assert/strict";
import test from "node:test";
import { signCollabTicket, verifyCollabTicket } from "./collab-auth.mjs";

test("collaboration tickets are room-bound and short-lived", () => {
  const secret = "test-secret-with-enough-entropy";
  const token = signCollabTicket({ room: "cut-editor:room-12345678", expiresAt: 1060 }, secret);
  assert.equal(verifyCollabTicket(token, "cut-editor:room-12345678", secret, 1000), true);
  assert.equal(verifyCollabTicket(token, "cut-editor:another-room", secret, 1000), false);
  assert.equal(verifyCollabTicket(token, "cut-editor:room-12345678", secret, 1061), false);
  assert.equal(verifyCollabTicket(`${token}x`, "cut-editor:room-12345678", secret, 1000), false);
});
