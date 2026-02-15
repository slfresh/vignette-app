import type { CountryCode } from "@/types/vignette";

/** Single camera feed entry for a border crossing. */
export type CameraFeed = {
  label: string;
  url: string;
  /** Approximate lat/lon for proximity matching – used to pick nearest crossing to user's route */
  lat: number;
  lon: number;
};

/** Camera feed with distance to the user's route crossing point. */
export type CameraFeedWithDistance = CameraFeed & {
  /** Distance in km from the route crossing point to this camera's crossing */
  distanceKm: number;
};

/**
 * Border crossings with live camera feeds (HAK – Croatian borders).
 * Used to show camera pins on the map when the user enables "Show border cameras".
 *
 * When a route crosses a border at (lat, lon), we show the NEAREST camera(s) to that point –
 * the crossing on their route plus 1–2 nearby alternatives (e.g. if Bijača is busy, try Ivanica).
 */
export type BorderCameraPin = {
  crossingCode: string;
  /** Camera feeds with coordinates – we pick nearest to route crossing */
  cameras: CameraFeed[];
  countries: [CountryCode, CountryCode];
};

/** Max number of cameras to show per crossing (nearest on route + alternatives) */
const MAX_CAMERAS_PER_CROSSING = 3;

/** Max km – only show alternative crossings within this distance */
const MAX_ALTERNATIVE_KM = 80;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BORDER_CAMERAS: BorderCameraPin[] = [
  // Croatia ↔ Slovenia – HAK
  // Coordinates sourced from OpenStreetMap / Mapcarta border checkpoint nodes
  {
    crossingCode: "HR-SI",
    cameras: [
      { label: "Bregana", url: "https://m.hak.hr/kamera.asp?g=2&k=3", lat: 45.8422, lon: 15.6993 },
      { label: "Macelj", url: "https://m.hak.hr/kamera.asp?g=2&k=16", lat: 46.2660, lon: 15.8693 },
      { label: "Pasjak", url: "https://m.hak.hr/kamera.asp?g=2&k=21", lat: 45.4833, lon: 14.2167 },
      { label: "Rupa", url: "https://m.hak.hr/kamera.asp?g=2&k=28", lat: 45.4780, lon: 14.2860 },
    ],
    countries: ["HR", "SI"],
  },
  // Croatia ↔ Serbia – HAK
  {
    crossingCode: "HR-RS",
    cameras: [
      { label: "Bajakovo", url: "https://m.hak.hr/kamera.asp?g=2&k=1", lat: 45.0484, lon: 19.0983 },
      { label: "Erdut", url: "https://m.hak.hr/kamera.asp?g=2&k=197", lat: 45.5145, lon: 19.0783 },
      { label: "Ilok", url: "https://m.hak.hr/kamera.asp?g=2&k=200", lat: 45.2249, lon: 19.4010 },
      { label: "Tovarnik", url: "https://m.hak.hr/kamera.asp?g=2&k=196", lat: 45.1548, lon: 19.1753 },
    ],
    countries: ["HR", "RS"],
  },
  // Croatia ↔ Bosnia – HAK
  {
    crossingCode: "HR-BA",
    cameras: [
      { label: "Nova Sela / Bijača", url: "https://m.hak.hr/kamera.asp?g=2&k=137", lat: 43.1232, lon: 17.5749 },
      { label: "Metković", url: "https://m.hak.hr/kamera.asp?g=2&k=136", lat: 43.0505, lon: 17.6613 },
      { label: "Klek / Neum 1", url: "https://m.hak.hr/kamera.asp?g=2&k=138", lat: 42.9400, lon: 17.5792 },
      { label: "Zaton Doli / Neum 2", url: "https://m.hak.hr/kamera.asp?g=2&k=139", lat: 42.8883, lon: 17.6526 },
      { label: "BIH Ivanica", url: "https://m.hak.hr/kamera.asp?g=2&k=182", lat: 42.6629, lon: 18.1628 },
      { label: "Brgat", url: "https://m.hak.hr/kamera.asp?g=2&k=208", lat: 42.6522, lon: 18.1591 },
      { label: "BIH Crveni Grm", url: "https://m.hak.hr/kamera.asp?g=2&k=181", lat: 43.1740, lon: 17.4749 },
      { label: "Aržano", url: "https://m.hak.hr/kamera.asp?g=2&k=193", lat: 43.5806, lon: 17.0036 },
      { label: "Vinjani Gornji", url: "https://m.hak.hr/kamera.asp?g=2&k=282", lat: 43.4598, lon: 17.2845 },
      { label: "Vinjani Donji", url: "https://m.hak.hr/kamera.asp?g=2&k=39", lat: 43.4222, lon: 17.2743 },
      { label: "Slavonski Brod", url: "https://m.hak.hr/kamera.asp?g=2&k=140", lat: 45.1568, lon: 18.0022 },
      { label: "BIH Bosanski Brod", url: "https://m.hak.hr/kamera.asp?g=2&k=184", lat: 45.1462, lon: 18.0059 },
      { label: "Svilaj", url: "https://m.hak.hr/kamera.asp?g=2&k=211", lat: 45.1147, lon: 18.3218 },
      { label: "BIH Orašje", url: "https://m.hak.hr/kamera.asp?g=2&k=183", lat: 45.0362, lon: 18.6937 },
      { label: "Gunja", url: "https://m.hak.hr/kamera.asp?g=2&k=206", lat: 44.8867, lon: 18.8152 },
      { label: "Stara Gradiška", url: "https://m.hak.hr/kamera.asp?g=2&k=32", lat: 45.1511, lon: 17.2463 },
      { label: "BIH Bosanska Gradiška", url: "https://m.hak.hr/kamera.asp?g=2&k=185", lat: 45.1471, lon: 17.2544 },
      { label: "Kamensko", url: "https://m.hak.hr/kamera.asp?g=2&k=192", lat: 43.6119, lon: 16.9733 },
      { label: "BIH Izačić", url: "https://m.hak.hr/kamera.asp?g=2&k=179", lat: 44.8785, lon: 15.7927 },
      { label: "BIH Prisika", url: "https://m.hak.hr/kamera.asp?g=2&k=180", lat: 44.2368, lon: 17.4160 },
      { label: "Maljevac", url: "https://m.hak.hr/kamera.asp?g=2&k=177", lat: 45.1977, lon: 15.7926 },
    ],
    countries: ["HR", "BA"],
  },
  // Croatia ↔ Montenegro – HAK
  {
    crossingCode: "HR-ME",
    cameras: [
      { label: "Karasovići", url: "https://m.hak.hr/kamera.asp?g=2&k=141", lat: 42.4907, lon: 18.4343 },
      { label: "Vitaljina", url: "https://m.hak.hr/kamera.asp?g=2&k=209", lat: 42.4232, lon: 18.5137 },
    ],
    countries: ["HR", "ME"],
  },
];

function crossingKey(a: CountryCode, b: CountryCode): string {
  const codes = [a, b].sort();
  return `${codes[0]}-${codes[1]}`;
}

/** Flat list of all border cameras – for showing every camera on the map regardless of route. */
export type CameraFeedWithBorder = CameraFeed & {
  countryCodeFrom: CountryCode;
  countryCodeTo: CountryCode;
};

export function getAllCameraFeeds(): CameraFeedWithBorder[] {
  const feeds: CameraFeedWithBorder[] = [];
  for (const pin of BORDER_CAMERAS) {
    const [from, to] = pin.countries;
    for (const cam of pin.cameras) {
      feeds.push({ ...cam, countryCodeFrom: from, countryCodeTo: to });
    }
  }
  return feeds;
}

/**
 * Returns camera pin config for crossings that match the given border crossing.
 * Shows the NEAREST camera(s) to the route's crossing point – the one on their route
 * plus up to 2 nearby alternatives (e.g. if Bijača is busy, try Ivanica).
 */
export function getCameraPinsForCrossings(
  crossings: Array<{ countryCodeFrom: CountryCode; countryCodeTo: CountryCode; lat: number; lon: number }>
): Array<{
  countryCodeFrom: CountryCode;
  countryCodeTo: CountryCode;
  lat: number;
  lon: number;
  /** Nearest camera name – useful for showing crossing name in route timeline */
  nearestCameraLabel: string;
  cameras: CameraFeedWithDistance[];
}> {
  const keyToPin = new Map(BORDER_CAMERAS.map((pin) => [crossingKey(...pin.countries), pin]));

  return crossings
    .map((crossing) => {
      const key = crossingKey(crossing.countryCodeFrom, crossing.countryCodeTo);
      const pin = keyToPin.get(key);
      if (!pin) {
        return null;
      }

      // Sort cameras by distance to route crossing, then take nearest + alternatives
      const withDistance = pin.cameras.map((cam) => ({
        ...cam,
        distanceKm: Math.round(haversineKm(crossing.lat, crossing.lon, cam.lat, cam.lon)),
      }));
      const withinRange = withDistance.filter((c) => c.distanceKm <= MAX_ALTERNATIVE_KM);
      const sorted = (withinRange.length ? withinRange : withDistance).sort((a, b) => a.distanceKm - b.distanceKm);
      const nearest = sorted.slice(0, MAX_CAMERAS_PER_CROSSING);

      return {
        ...crossing,
        nearestCameraLabel: nearest[0]?.label ?? "",
        cameras: nearest,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}
