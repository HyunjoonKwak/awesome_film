"use client";

import { useState } from "react";
import { LogOut, Share2 } from "lucide-react";
import { toast } from "sonner";
import { getBridge } from "./yjs-bridge";
import { useAwarenessStore } from "./awareness-store";
import { useT } from "@/i18n/use-t";

const DEFAULT_WS = "wss://demos.yjs.dev"; // public test relay

export function CollabBar() {
  const peers = useAwarenessStore((s) => s.peers);
  const [joined, setJoined] = useState(false);
  // Random per-session room instead of a shared public one, so clicking Share
  // doesn't sync your project into a guessable room on the open relay. Share
  // this generated code out-of-band with whoever should join.
  const [room, setRoom] = useState(() => `cut-${crypto.randomUUID().slice(0, 8)}`);
  const t = useT();

  const join = () => {
    try {
      getBridge().joinRoom(DEFAULT_WS, `cut-editor:${room}`);
      setJoined(true);
      toast.success(t("collab.joined", { room }));
    } catch (err) {
      toast.error(t("collab.joinFailed", { msg: err instanceof Error ? err.message : String(err) }));
    }
  };
  const leave = () => {
    try {
      getBridge().leaveRoom();
      setJoined(false);
      toast.info(t("collab.left"));
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center gap-2">
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
      {joined ? (
        <button
          type="button"
          onClick={leave}
          className="btn-ghost px-2 py-1 text-xs"
          title={t("collab.leave")}
        >
          <LogOut className="size-3.5" />
          {t("collab.leave")}
        </button>
      ) : (
        <>
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder={t("collab.room")}
            className="w-24 rounded bg-white/5 px-2 py-1 text-xs text-ink-1 outline-none focus:bg-white/10"
          />
          <button
            type="button"
            onClick={join}
            className="btn-ghost px-2 py-1 text-xs"
            title={t("collab.share")}
          >
            <Share2 className="size-3.5" />
            {t("collab.share")}
          </button>
        </>
      )}
    </div>
  );
}
