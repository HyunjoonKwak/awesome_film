// Pure geo math + NOAA sun times. No dependencies, unit-tested.

export const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
};

// NOAA solar calculation — sunrise/sunset in epoch ms (UTC) for a date+place.
// Accuracy ±2min, ample for golden-hour tagging.
export const sunTimes = (
  epochMs: number,
  lat: number,
  lon: number,
): { sunrise: number; sunset: number } | null => {
  const rad = Math.PI / 180;
  const jdToMs = (jd: number) => (jd - 2440587.5) * 86400000;
  const inputJd = epochMs / 86400000 + 2440587.5;

  const forN = (n: number) => {
    const Jstar = n - lon / 360;
    const M = (357.5291 + 0.98560028 * Jstar) % 360;
    const C =
      1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    const lambda = (M + C + 180 + 102.9372) % 360;
    const Jtransit =
      2451545.0 + Jstar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
    const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.4397 * rad));
    const cosH =
      (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(delta)) /
      (Math.cos(lat * rad) * Math.cos(delta));
    if (cosH < -1 || cosH > 1) return null; // polar day/night
    const H = Math.acos(cosH) / rad;
    return { Jtransit, H };
  };

  // Day-number bookkeeping is a classic off-by-one trap (a sunset query can
  // resolve to the previous day's transit). Evaluate the neighbouring cycles
  // and keep the one whose solar transit is closest to the queried instant.
  const nBase = Math.round(inputJd - 2451545.0 + 0.0008);
  let best: { Jtransit: number; H: number } | null = null;
  for (const n of [nBase - 1, nBase, nBase + 1]) {
    const r = forN(n);
    if (!r) continue;
    if (!best || Math.abs(r.Jtransit - inputJd) < Math.abs(best.Jtransit - inputJd)) best = r;
  }
  if (!best) return null;
  return {
    sunrise: Math.round(jdToMs(best.Jtransit - best.H / 360)),
    sunset: Math.round(jdToMs(best.Jtransit + best.H / 360)),
  };
};

// Golden hour: within ±70 minutes of sunrise or sunset.
export const isGoldenHour = (epochMs: number, lat: number, lon: number): boolean => {
  const t = sunTimes(epochMs, lat, lon);
  if (!t) return false;
  const w = 70 * 60000;
  return Math.abs(epochMs - t.sunrise) <= w || Math.abs(epochMs - t.sunset) <= w;
};

// Transport guess from average speed between events (design tiers).
export type Transport = "walk" | "drive" | "train" | "flight";
export const guessTransport = (km: number, hours: number): Transport => {
  if (hours <= 0) return "drive";
  const kmh = km / hours;
  if (kmh < 7) return "walk";
  if (kmh < 160) return "drive";
  if (kmh < 320) return "train";
  return "flight";
};

export const TRANSPORT_LABEL: Record<Transport, string> = {
  walk: "도보",
  drive: "차량",
  train: "기차",
  flight: "비행",
};
