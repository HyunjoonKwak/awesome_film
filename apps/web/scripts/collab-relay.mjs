import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { createYjsServer } from "yjs-server";
import { verifyCollabTicket } from "./collab-auth.mjs";

const roomFromRequest = (request) => {
  try {
    const url = new URL(request.url ?? "/", "http://relay.invalid");
    const room = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
    return /^cut-editor:[a-zA-Z0-9_-]{8,128}$/.test(room)
      ? { room, token: url.searchParams.get("token") }
      : null;
  } catch {
    return null;
  }
};

const requirePositiveInteger = (value, name) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be positive`);
};

export const createCollabRelay = ({
  host = "127.0.0.1",
  port = 32120,
  secret,
  allowedOrigins = [],
  maxConnections = 200,
  maxPayloadBytes = 8 * 1024 * 1024,
  maxConnectsPerMinute = 30,
  maxMessagesPerWindow = 240,
  trustProxy = false,
} = {}) => {
  if (!secret || secret.length < 32)
    throw new Error("COLLAB_HMAC_SECRET must be at least 32 characters");
  const allowedOriginSet = new Set(allowedOrigins);
  if (allowedOriginSet.size === 0) throw new Error("COLLAB_ALLOWED_ORIGINS is required");
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("Invalid PORT");
  requirePositiveInteger(maxConnections, "COLLAB_MAX_CONNECTIONS");
  requirePositiveInteger(maxPayloadBytes, "COLLAB_MAX_PAYLOAD_BYTES");
  requirePositiveInteger(maxConnectsPerMinute, "COLLAB_MAX_CONNECTS_PER_MINUTE");
  requirePositiveInteger(maxMessagesPerWindow, "COLLAB_MAX_MESSAGES_PER_10_SECONDS");

  const connectionAttempts = new Map();
  let activeConnections = 0;

  const clientIp = (request) => {
    if (trustProxy) {
      const forwarded = request.headers["x-forwarded-for"];
      if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
    }
    return request.socket.remoteAddress ?? "unknown";
  };

  const allowConnectionAttempt = (ip) => {
    const now = Date.now();
    const recent = (connectionAttempts.get(ip) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= maxConnectsPerMinute) return false;
    recent.push(now);
    connectionAttempts.set(ip, recent);
    return true;
  };

  const httpServer = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end(JSON.stringify({ ok: true, connections: activeConnections }));
  });
  const webSocketServer = new WebSocketServer({
    server: httpServer,
    maxPayload: maxPayloadBytes,
    verifyClient: (info, done) => {
      const requestData = roomFromRequest(info.req);
      const allowed =
        activeConnections < maxConnections &&
        allowedOriginSet.has(info.origin) &&
        allowConnectionAttempt(clientIp(info.req)) &&
        requestData &&
        verifyCollabTicket(requestData.token, requestData.room, secret);
      done(Boolean(allowed), allowed ? 101 : 401, allowed ? undefined : "Unauthorized");
    },
  });
  const yjsServer = createYjsServer({ createDoc: () => new Y.Doc() });

  webSocketServer.on("connection", (socket, request) => {
    activeConnections++;
    let windowStartedAt = Date.now();
    let messages = 0;
    socket.on("message", () => {
      const now = Date.now();
      if (now - windowStartedAt >= 10_000) {
        windowStartedAt = now;
        messages = 0;
      }
      messages++;
      if (messages > maxMessagesPerWindow) socket.close(1008, "Rate limit exceeded");
    });
    socket.once("close", () => {
      activeConnections = Math.max(0, activeConnections - 1);
    });
    yjsServer.handleConnection(socket, request);
  });

  return {
    listen: () =>
      new Promise((resolve, reject) => {
        const onError = (error) => reject(error);
        httpServer.once("error", onError);
        httpServer.listen(port, host, () => {
          httpServer.off("error", onError);
          resolve(httpServer.address());
        });
      }),
    close: () =>
      new Promise((resolve, reject) => {
        for (const client of webSocketServer.clients) client.terminate();
        webSocketServer.close(() => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      }),
  };
};

const isCommandLine = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCommandLine) {
  const relay = createCollabRelay({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 32120),
    secret: process.env.COLLAB_HMAC_SECRET,
    allowedOrigins: (process.env.COLLAB_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxConnections: Number(process.env.COLLAB_MAX_CONNECTIONS ?? 200),
    maxPayloadBytes: Number(process.env.COLLAB_MAX_PAYLOAD_BYTES ?? 8 * 1024 * 1024),
    maxConnectsPerMinute: Number(process.env.COLLAB_MAX_CONNECTS_PER_MINUTE ?? 30),
    maxMessagesPerWindow: Number(process.env.COLLAB_MAX_MESSAGES_PER_10_SECONDS ?? 240),
    trustProxy: process.env.COLLAB_TRUST_PROXY === "1",
  });
  await relay.listen();
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    relay.close().catch((error) => console.error(error));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
