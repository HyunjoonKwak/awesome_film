type CollabServerError = "missing" | "invalid" | "insecure";

export type CollabServerResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly error: CollabServerError };

const isLocalHost = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export const isLocalCollabServer = (server: string): boolean => {
  try {
    return isLocalHost(new URL(server).hostname);
  } catch {
    return false;
  }
};

export const resolveCollabServer = (raw: string | undefined): CollabServerResult => {
  const value = raw?.trim();
  if (!value) return { ok: false, error: "missing" };
  try {
    const url = new URL(value);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") {
      return { ok: false, error: "invalid" };
    }
    if (url.username || url.password || url.hash || url.search) {
      return { ok: false, error: "invalid" };
    }
    if (url.protocol === "ws:" && !isLocalHost(url.hostname)) {
      return { ok: false, error: "insecure" };
    }
    return { ok: true, url: url.toString().replace(/\/$/, "") };
  } catch {
    return { ok: false, error: "invalid" };
  }
};

export const configuredCollabServer = (): CollabServerResult =>
  resolveCollabServer(process.env.NEXT_PUBLIC_COLLAB_WS_URL);

export const resolveCollabTicketUrl = (raw: string | undefined, baseUrl: string): string | null => {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value, baseUrl);
    if (url.username || url.password || url.hash || url.search) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost(url.hostname))) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
};

export const configuredCollabTicketUrl = (): string | null =>
  typeof window === "undefined"
    ? null
    : resolveCollabTicketUrl(process.env.NEXT_PUBLIC_COLLAB_TICKET_URL, window.location.href);

export const normalizeRoomCode = (raw: string): string | null => {
  const room = raw.trim();
  return room.length >= 8 && room.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(room) ? room : null;
};
