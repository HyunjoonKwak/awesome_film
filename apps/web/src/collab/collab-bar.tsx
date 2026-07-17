"use client";

import { useT } from "@/i18n/use-t";
import { Copy, LogOut, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAwarenessStore } from "./awareness-store";
import {
  configuredCollabServer,
  configuredCollabTicketUrl,
  isLocalCollabServer,
  normalizeRoomCode,
} from "./collab-config";
import { useCollabSessionStore } from "./collab-session-store";
import { useMediaTransferStore } from "./media-transfer-store";
import { getBridge } from "./yjs-bridge";

export function CollabBar() {
  const peers = useAwarenessStore((s) => s.peers);
  const joinedRoom = useCollabSessionStore((state) => state.room);
  const connectionStatus = useCollabSessionStore((state) => state.status);
  const transfer = useMediaTransferStore((state) => state.progress);
  const transferError = useMediaTransferStore((state) => state.error);
  // Random per-session room instead of a shared public one, so clicking Share
  // doesn't sync your project into a guessable room on the open relay. Share
  // this generated code out-of-band with whoever should join.
  const [room, setRoom] = useState(() => `cut-${crypto.randomUUID()}`);
  const t = useT();
  const previousStatus = useRef(connectionStatus);

  // The room code lives in a popover behind the Share button — hidden until
  // the user actually wants to co-edit, with an explanation of what it's for.
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(room);
      toast.success(t("collab.copied"));
    } catch {
      toast.error(t("collab.copyFailed"));
    }
  };

  useEffect(() => {
    if (connectionStatus === "connected" && previousStatus.current !== "connected" && joinedRoom) {
      toast.success(t("collab.joined", { room: joinedRoom.replace(/^cut-editor:/, "") }));
    }
    previousStatus.current = connectionStatus;
  }, [connectionStatus, joinedRoom, t]);

  const join = async () => {
    try {
      const server = configuredCollabServer();
      if (!server.ok) {
        const key =
          server.error === "missing"
            ? "collab.serverMissing"
            : server.error === "insecure"
              ? "collab.serverInsecure"
              : "collab.serverInvalid";
        toast.error(t(key));
        return;
      }
      const roomCode = normalizeRoomCode(room);
      if (!roomCode) {
        toast.error(t("collab.roomInvalid"));
        return;
      }
      const roomName = `cut-editor:${roomCode}`;
      let token: string | undefined;
      if (!isLocalCollabServer(server.url)) {
        const ticketUrl = configuredCollabTicketUrl();
        if (!ticketUrl) {
          toast.error(t("collab.ticketMissing"));
          return;
        }
        const response = await fetch(ticketUrl, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room: roomName }),
        });
        if (!response.ok) throw new Error(`ticket request failed (${response.status})`);
        const payload = (await response.json()) as { token?: unknown };
        if (
          typeof payload.token !== "string" ||
          payload.token.length < 16 ||
          payload.token.length > 4096
        ) {
          throw new Error("ticket endpoint returned an invalid token");
        }
        token = payload.token;
      }
      getBridge().joinRoom(server.url, roomName, token);
      setPanelOpen(false);
    } catch (err) {
      toast.error(
        t("collab.joinFailed", { msg: err instanceof Error ? err.message : String(err) }),
      );
    }
  };
  const leave = () => {
    try {
      getBridge().leaveRoom();
      toast.info(t("collab.left"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
      {transfer ? (
        <span
          className="max-w-28 truncate text-3xs text-ink-2"
          title={t("collab.receiving", { name: transfer.name })}
        >
          {transfer.name}{" "}
          {transfer.totalBytes > 0
            ? `${Math.round((transfer.receivedBytes / transfer.totalBytes) * 100)}%`
            : "…"}
        </span>
      ) : transferError ? (
        <span className="max-w-28 truncate text-3xs text-red-400" title={transferError}>
          {t("collab.syncFailed")}
        </span>
      ) : null}
      <div className="flex -space-x-2">
        {Array.from(peers.values())
          .slice(0, 5)
          .map((p) => (
            <span
              key={p.id}
              className="inline-flex size-5 items-center justify-center rounded-full border border-panel-1 text-3xs font-medium text-white"
              style={{ backgroundColor: p.color }}
              title={p.name}
            >
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
      </div>
      {joinedRoom ? (
        <>
          <span
            className="text-3xs text-ink-2"
            data-testid="collab-status"
            data-status={connectionStatus}
            aria-live="polite"
          >
            {t(`collab.${connectionStatus}`)}
          </span>
          <button
            type="button"
            onClick={leave}
            className="btn-ghost px-2 py-1 text-xs"
            title={t("collab.leave")}
          >
            <LogOut className="size-3.5" />
            {t("collab.leave")}
          </button>
        </>
      ) : (
        <div className="relative" ref={panelRef}>
          <button
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            className="btn-ghost px-2 py-1 text-xs"
            title={t("collab.panelTitle")}
            aria-expanded={panelOpen}
          >
            <Share2 className="size-3.5" />
            {t("collab.share")}
          </button>
          {panelOpen && (
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-white/10 bg-panel-2 p-3 shadow-xl">
              <p className="text-xs font-medium text-ink-1">{t("collab.panelTitle")}</p>
              <p className="mt-1 text-2xs leading-relaxed text-ink-3">{t("collab.panelDesc")}</p>
              <label className="mt-2.5 block">
                <span className="text-3xs uppercase tracking-wider text-ink-3">
                  {t("collab.room")}
                </span>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    aria-label={t("collab.room")}
                    className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1 font-mono text-2xs text-ink-1 outline-none focus:bg-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => void copyRoomCode()}
                    className="btn-ghost p-1.5"
                    title={t("collab.copy")}
                    aria-label={t("collab.copy")}
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </label>
              {!configuredCollabServer().ok && (
                <p className="mt-2 text-3xs leading-relaxed text-amber-300">
                  {t("collab.serverMissing")}
                </p>
              )}
              <button
                type="button"
                onClick={() => void join()}
                className="mt-2.5 w-full rounded bg-accent px-2 py-1.5 text-xs font-medium text-accent-fg hover:opacity-90"
              >
                {t("collab.join")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
