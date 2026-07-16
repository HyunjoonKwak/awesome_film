import { createHmac, timingSafeEqual } from "node:crypto";

const signatureFor = (payload, secret) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const signCollabTicket = ({ room, expiresAt }, secret) => {
  if (!secret || !room || !Number.isSafeInteger(expiresAt)) throw new Error("Invalid ticket input");
  const payload = Buffer.from(JSON.stringify({ room, exp: expiresAt })).toString("base64url");
  return `${payload}.${signatureFor(payload, secret)}`;
};

export const verifyCollabTicket = (token, room, secret, nowSeconds = Date.now() / 1000) => {
  if (typeof token !== "string" || !secret || token.length > 4096) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = signatureFor(payload, secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    return false;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return (
      data.room === room &&
      Number.isSafeInteger(data.exp) &&
      data.exp >= nowSeconds &&
      data.exp <= nowSeconds + 5 * 60
    );
  } catch {
    return false;
  }
};
