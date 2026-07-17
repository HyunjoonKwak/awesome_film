import { haversineKm } from "./geo";

// Offline reverse geocoding against a compact embedded gazetteer — no network,
// no tiles. Curated for the target use (KR detail + world majors). A fuller
// GeoNames pack can replace CITY_DB later without touching callers.
// Entries: [name, lat, lon]

type City = readonly [string, number, number];

const KR: readonly City[] = [
  ["서울", 37.5665, 126.978],
  ["부산", 35.1796, 129.0756],
  ["인천", 37.4563, 126.7052],
  ["대구", 35.8714, 128.6014],
  ["대전", 36.3504, 127.3845],
  ["광주", 35.1595, 126.8526],
  ["울산", 35.5384, 129.3114],
  ["세종", 36.4801, 127.289],
  ["수원", 37.2636, 127.0286],
  ["춘천", 37.8813, 127.7298],
  ["강릉", 37.7519, 128.8761],
  ["속초", 38.2072, 128.5918],
  ["평창", 37.3705, 128.39],
  ["삼척", 37.4499, 129.1651],
  ["단양", 36.9845, 128.3655],
  ["전주", 35.8242, 127.148],
  ["여수", 34.7604, 127.6622],
  ["순천", 34.9506, 127.4874],
  ["목포", 34.8118, 126.3922],
  ["경주", 35.8562, 129.2247],
  ["포항", 36.019, 129.3435],
  ["안동", 36.5684, 128.7294],
  ["통영", 34.8544, 128.4331],
  ["거제", 34.8806, 128.6211],
  ["남해", 34.8376, 127.8924],
  ["제주", 33.4996, 126.5312],
  ["서귀포", 33.2541, 126.56],
  ["가평", 37.8315, 127.5105],
  ["양양", 38.0754, 128.619],
  ["동해", 37.5247, 129.1143],
  ["태안", 36.7456, 126.2979],
  ["보령", 36.3335, 126.6127],
  ["군산", 35.9676, 126.7366],
  ["담양", 35.3211, 126.9881],
  ["구례", 35.2024, 127.4629],
  ["하동", 35.0672, 127.7513],
];

const WORLD: readonly City[] = [
  ["Tokyo", 35.6762, 139.6503],
  ["Osaka", 34.6937, 135.5023],
  ["Kyoto", 35.0116, 135.7681],
  ["Sapporo", 43.0618, 141.3545],
  ["Fukuoka", 33.5902, 130.4017],
  ["Okinawa", 26.2124, 127.6809],
  ["Taipei", 25.033, 121.5654],
  ["Hong Kong", 22.3193, 114.1694],
  ["Shanghai", 31.2304, 121.4737],
  ["Beijing", 39.9042, 116.4074],
  ["Bangkok", 13.7563, 100.5018],
  ["Chiang Mai", 18.7883, 98.9853],
  ["Da Nang", 16.0544, 108.2022],
  ["Hanoi", 21.0278, 105.8342],
  ["Ho Chi Minh", 10.8231, 106.6297],
  ["Singapore", 1.3521, 103.8198],
  ["Kuala Lumpur", 3.139, 101.6869],
  ["Bali", -8.4095, 115.1889],
  ["Cebu", 10.3157, 123.8854],
  ["Manila", 14.5995, 120.9842],
  ["Guam", 13.4443, 144.7937],
  ["Saipan", 15.2123, 145.7545],
  ["Sydney", -33.8688, 151.2093],
  ["Melbourne", -37.8136, 144.9631],
  ["Auckland", -36.8509, 174.7645],
  ["Honolulu", 21.3069, -157.8583],
  ["Los Angeles", 34.0522, -118.2437],
  ["San Francisco", 37.7749, -122.4194],
  ["Las Vegas", 36.1699, -115.1398],
  ["Seattle", 47.6062, -122.3321],
  ["New York", 40.7128, -74.006],
  ["Chicago", 41.8781, -87.6298],
  ["Vancouver", 49.2827, -123.1207],
  ["Toronto", 43.6532, -79.3832],
  ["London", 51.5074, -0.1278],
  ["Paris", 48.8566, 2.3522],
  ["Rome", 41.9028, 12.4964],
  ["Florence", 43.7696, 11.2558],
  ["Venice", 45.4408, 12.3155],
  ["Barcelona", 41.3874, 2.1686],
  ["Madrid", 40.4168, -3.7038],
  ["Lisbon", 38.7223, -9.1393],
  ["Berlin", 52.52, 13.405],
  ["Munich", 48.1351, 11.582],
  ["Prague", 50.0755, 14.4378],
  ["Vienna", 48.2082, 16.3738],
  ["Budapest", 47.4979, 19.0402],
  ["Zurich", 47.3769, 8.5417],
  ["Interlaken", 46.6863, 7.8632],
  ["Amsterdam", 52.3676, 4.9041],
  ["Istanbul", 41.0082, 28.9784],
  ["Dubai", 25.2048, 55.2708],
  ["Cairns", -16.9186, 145.7781],
];

const CITY_DB: readonly City[] = [...KR, ...WORLD];

// Nearest gazetteer city within `maxKm`; KR entries effectively give 시/군
// resolution, elsewhere major-city resolution.
export const reverseGeocode = (lat: number, lon: number, maxKm = 60): string | null => {
  let best: string | null = null;
  let bestKm = maxKm;
  for (const [name, clat, clon] of CITY_DB) {
    const km = haversineKm(lat, lon, clat, clon);
    if (km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return best;
};

// Coordinate fallback label when nothing is near ("37.45°N 129.17°E").
export const coordLabel = (lat: number, lon: number): string =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;
