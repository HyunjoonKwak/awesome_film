// YouTube video metadata via the public oEmbed endpoint (CORS-enabled),
// with noembed.com as a fallback. Only ever called with validated YouTube
// URLs — never arbitrary hosts.

const YT_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export const isYoutubeUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return (u.protocol === "https:" || u.protocol === "http:") && YT_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

// Plain http(s) check for user-entered source URLs — anything else
// (javascript:, file:, malformed) is refused at save time.
export const isHttpUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export interface YoutubeMeta {
  readonly title: string;
  readonly author: string;
}

export const fetchYoutubeMeta = async (url: string): Promise<YoutubeMeta | null> => {
  if (!isYoutubeUrl(url)) return null;
  const endpoints = [
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { title?: unknown; author_name?: unknown };
      if (typeof data.title === "string" && data.title.length > 0) {
        return {
          title: data.title,
          author: typeof data.author_name === "string" ? data.author_name : "",
        };
      }
    } catch {
      // network/CORS failure — try the next endpoint
    }
  }
  return null;
};
