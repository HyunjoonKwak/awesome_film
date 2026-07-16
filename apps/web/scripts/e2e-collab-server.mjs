import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import { createYjsServer } from "yjs-server";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 32120);
const httpServer = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("okay");
});
const webSocketServer = new WebSocketServer({ server: httpServer });
const yjsServer = createYjsServer({ createDoc: () => new Y.Doc() });

webSocketServer.on("connection", (socket, request) => {
  yjsServer.handleConnection(socket, request);
});

httpServer.listen(port, host);

const shutdown = () => {
  webSocketServer.close(() => httpServer.close());
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
