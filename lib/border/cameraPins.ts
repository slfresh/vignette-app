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
 * Border crossings with live camera feeds (uzivokamere.com, HAK).
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
  // Hungary ↔ Serbia
  {
    crossingCode: "HU-RS",
    cameras: [{ label: "Horgoš / Röszke", url: "https://uzivokamere.com/granicni-prelaz-horgos-kamera-madjarska-srbija-izlaz/", lat: 46.16, lon: 19.99 }],
    countries: ["HU", "RS"],
  },
  // Serbia ↔ Bulgaria
  {
    crossingCode: "RS-BG",
    cameras: [{ label: "Gradina / Kalotina", url: "https://uzivokamere.com/granicni-prelaz-gradina-srbija-bugarska/", lat: 43.11, lon: 22.92 }],
    countries: ["RS", "BG"],
  },
  // Bulgaria ↔ Turkey
  {
    crossingCode: "BG-TR",
    cameras: [{ label: "Kapikule / Kapitan Andreevo", url: "https://uzivokamere.com/granicni-prelaz-andreevo-bugarska-turska/", lat: 41.69, lon: 26.36 }],
    countries: ["BG", "TR"],
  },
  // Bulgaria ↔ Greece
  {
    crossingCode: "BG-GR",
    cameras: [{ label: "Kulata / Promachonas", url: "https://uzivokamere.com/granicni-prelaz-kulata-bugarska-grcka/", lat: 41.38, lon: 23.35 }],
    countries: ["BG", "GR"],
  },
  // Turkey ↔ Greece
  {
    crossingCode: "GR-TR",
    cameras: [{ label: "Pazarkule / Kastanies", url: "https://uzivokamere.com/granicni-prelaz-pazarkule-turska-grcka/", lat: 41.14, lon: 26.30 }],
    countries: ["GR", "TR"],
  },
  // Croatia ↔ Slovenia – HAK + uzivokamere
  {
    crossingCode: "HR-SI",
    cameras: [
      { label: "Bregana / Obrezje", url: "https://uzivokamere.com/granicni-prelaz-bregana-kamera-hrvatska-slovenija/", lat: 45.84, lon: 15.70 },
      { label: "Bregana (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=3", lat: 45.84, lon: 15.70 },
      { label: "Macelj (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=16", lat: 46.24, lon: 15.88 },
      { label: "Pasjak (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=21", lat: 45.55, lon: 14.27 },
      { label: "Rupa (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=28", lat: 45.47, lon: 14.29 },
    ],
    countries: ["HR", "SI"],
  },
  // Croatia ↔ Serbia – proximity-matched, HAK + uzivokamere
  {
    crossingCode: "HR-RS",
    cameras: [
      { label: "Batrovci / Bajakovo", url: "https://uzivokamere.com/granicni-prelaz-batrovci-kamere-srbija-hrvatska/", lat: 45.05, lon: 19.10 },
      { label: "Bajakovo (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=1", lat: 45.05, lon: 19.10 },
      { label: "Erdut", url: "https://uzivokamere.com/granicni-prelaz-erdut-kamera-hrvatska-srbija/", lat: 45.53, lon: 18.72 },
      { label: "Erdut (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=197", lat: 45.53, lon: 18.72 },
      { label: "Ilok", url: "https://uzivokamere.com/granicni-prelaz-ilok-kamera-hrvatska-srbija/", lat: 45.22, lon: 19.38 },
      { label: "Ilok (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=200", lat: 45.22, lon: 19.38 },
      { label: "Tovarnik / Šid", url: "https://uzivokamere.com/granicni-prelaz-tovarnik-hrvatska-srbija/", lat: 45.16, lon: 19.15 },
      { label: "Tovarnik (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=196", lat: 45.16, lon: 19.15 },
      { label: "Šid", url: "https://uzivokamere.com/granicni-prelaz-sid-srbija-hrvatska-2/", lat: 45.12, lon: 19.22 },
    ],
    countries: ["HR", "RS"],
  },
  // Croatia ↔ Bosnia – proximity-matched, HAK + uzivokamere
  {
    crossingCode: "HR-BA",
    cameras: [
      // ── Southern crossings (Dalmatia / Herzegovina) ──
      { label: "Nova Sela / Bijača (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=137", lat: 43.12, lon: 17.56 },
      { label: "Bijača / Nova Sela", url: "https://uzivokamere.com/granicni-prijelaz-ivanica-bih-hrvatska/", lat: 43.12, lon: 17.56 },
      { label: "Metković (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=136", lat: 43.05, lon: 17.65 },
      { label: "Doljani / Metković", url: "https://uzivokamere.com/granicni-prijelaz-doljani-bih-hrvatska/", lat: 43.05, lon: 17.65 },
      { label: "Klek / Neum 1 (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=138", lat: 42.95, lon: 17.56 },
      { label: "Zaton Doli / Neum 2 (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=139", lat: 42.88, lon: 17.55 },
      { label: "Neum", url: "https://uzivokamere.com/neum-bosna-i-hercegovina/", lat: 42.92, lon: 17.62 },
      { label: "BIH Ivanica (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=182", lat: 42.95, lon: 17.52 },
      { label: "Ivanica (Dubrovnik)", url: "https://uzivokamere.com/granicni-prijelaz-ivanica-bih-hrvatska/", lat: 42.95, lon: 17.52 },
      { label: "Brgat (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=208", lat: 42.65, lon: 18.10 },
      { label: "BIH Crveni Grm (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=181", lat: 43.22, lon: 17.44 },
      { label: "Crveni Grm", url: "https://uzivokamere.com/granicni-prijelaz-crveni-grm-bih-hrvatska/", lat: 43.22, lon: 17.44 },
      { label: "Aržano (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=193", lat: 43.58, lon: 16.95 },
      { label: "Vinjani Gornji (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=282", lat: 43.21, lon: 17.37 },
      { label: "Vinjani Donji (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=39", lat: 43.15, lon: 17.37 },
      { label: "Vinjani Donji / Gorica", url: "https://uzivokamere.com/vinjani-donji-hrvatska-bih/", lat: 43.15, lon: 17.37 },
      // ── Central crossings (Slavonia / Posavina) ──
      { label: "Slavonski Brod (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=140", lat: 45.16, lon: 18.01 },
      { label: "Slavonski Brod", url: "https://uzivokamere.com/granicni-prelaz-slavonski-brod-hrvatska-bih/", lat: 45.16, lon: 18.01 },
      { label: "BIH Bosanski Brod (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=184", lat: 45.14, lon: 17.98 },
      { label: "Brod", url: "https://uzivokamere.com/granicni-prelaz-brod-bih-hrvatska/", lat: 45.14, lon: 17.98 },
      { label: "Svilaj (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=211", lat: 45.06, lon: 17.95 },
      { label: "BIH Orašje (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=183", lat: 45.03, lon: 18.69 },
      { label: "Orašje", url: "https://uzivokamere.com/granicni-prelaz-orasje-bih-hrvatska/", lat: 45.03, lon: 18.69 },
      { label: "Gunja (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=206", lat: 44.88, lon: 18.85 },
      { label: "Gunja", url: "https://uzivokamere.com/granicni-prelaz-gunja-hrvatska-bih/", lat: 44.88, lon: 18.85 },
      { label: "Brčko", url: "https://uzivokamere.com/granicni-prelaz-brcko-bih-hrvatska/", lat: 44.88, lon: 18.82 },
      // ── Northern / Western crossings ──
      { label: "Stara Gradiška (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=32", lat: 45.14, lon: 17.25 },
      { label: "Stara Gradiška", url: "https://uzivokamere.com/granicni-prelaz-stara-gradiska-hrvatska-bih/", lat: 45.14, lon: 17.25 },
      { label: "BIH Bosanska Gradiška (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=185", lat: 45.14, lon: 17.24 },
      { label: "Gradiška", url: "https://uzivokamere.com/granicni-prelaz-gradiska-bih-hrvatska/", lat: 45.14, lon: 17.24 },
      { label: "Donja Gradina", url: "https://uzivokamere.com/granicni-prelaz-donja-gradina-bih-hrvatska/", lat: 45.25, lon: 16.88 },
      { label: "Kamensko (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=192", lat: 45.18, lon: 16.85 },
      { label: "Kamensko", url: "https://uzivokamere.com/granicni-prijelaz-izacic-bih-hrvatska/", lat: 45.18, lon: 16.85 },
      { label: "BIH Izačić (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=179", lat: 45.18, lon: 15.85 },
      { label: "BIH Prisika (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=180", lat: 45.48, lon: 15.35 },
      { label: "Prisika", url: "https://uzivokamere.com/granicni-prijelaz-prisika-bih-hrvatska/", lat: 45.48, lon: 15.35 },
      { label: "Maljevac (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=177", lat: 45.18, lon: 15.80 },
      { label: "Velika Kladuša", url: "https://uzivokamere.com/granicni-prijelaz-velika-kladusa-bih-hrvatska/", lat: 45.18, lon: 15.80 },
      { label: "Kozarska Dubica", url: "https://uzivokamere.com/granicni-prelaz-kozarska-dubica-bih-hrvatska-2/", lat: 45.18, lon: 16.85 },
      { label: "Kostajnica", url: "https://uzivokamere.com/granicni-prelaz-kostajnica-bih-hrvatska/", lat: 45.22, lon: 16.53 },
      { label: "Novi Grad / Dvor", url: "https://uzivokamere.com/granicni-prelaz-novi-grad-dvor-bih-hrvatska/", lat: 45.04, lon: 16.38 },
    ],
    countries: ["HR", "BA"],
  },
  // Croatia ↔ Montenegro – HAK + uzivokamere
  {
    crossingCode: "HR-ME",
    cameras: [
      { label: "Debeli Brijeg / Karasovići", url: "https://uzivokamere.com/granicni-prelaz-debeli-brijeg-karasovici-crna-gora-hrvatska/", lat: 42.56, lon: 18.52 },
      { label: "Karasovići (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=141", lat: 42.56, lon: 18.52 },
      { label: "Vitaljina (HAK)", url: "https://m.hak.hr/kamera.asp?g=2&k=209", lat: 42.50, lon: 18.52 },
    ],
    countries: ["HR", "ME"],
  },
  // Slovenia ↔ Italy
  {
    crossingCode: "IT-SI",
    cameras: [{ label: "Fernetiči / Vrtojba", url: "https://uzivokamere.com/granicni-prelaz-fernetici-slovenija-italija/", lat: 45.87, lon: 13.63 }],
    countries: ["IT", "SI"],
  },
  // Austria ↔ Hungary
  {
    crossingCode: "AT-HU",
    cameras: [{ label: "Nickelsdorf / Hegyeshalom", url: "https://uzivokamere.com/granicni-prelaz-nickelsdorf-austrija-madjarska/", lat: 47.85, lon: 17.14 }],
    countries: ["AT", "HU"],
  },
  // Serbia ↔ Montenegro
  {
    crossingCode: "RS-ME",
    cameras: [{ label: "Špiljani / Dračenovac", url: "https://uzivokamere.com/granicni-prelaz-spiljani-srbija-crna-gora-izlaz/", lat: 43.11, lon: 19.26 }],
    countries: ["RS", "ME"],
  },
  // Serbia ↔ North Macedonia
  {
    crossingCode: "RS-MK",
    cameras: [{ label: "Preševo / Tabanovce", url: "https://uzivokamere.com/granicni-prelaz-presevo-srbija-s-makedonija/", lat: 42.30, lon: 21.71 }],
    countries: ["RS", "MK"],
  },
  // North Macedonia ↔ Greece
  {
    crossingCode: "GR-MK",
    cameras: [{ label: "Bogorodica / Evzoni", url: "https://uzivokamere.com/bogorodica-severna-makedonija-grcka-evzoni/", lat: 41.12, lon: 22.50 }],
    countries: ["GR", "MK"],
  },
  // Bosnia ↔ Serbia – proximity-matched
  {
    crossingCode: "BA-RS",
    cameras: [
      { label: "Bosanska Rača / Sremska Rača", url: "https://uzivokamere.com/granicni-prelaz-bosanska-raca-bih-srbija-izlaz/", lat: 44.98, lon: 19.38 },
      { label: "Pavlovića most", url: "https://uzivokamere.com/granicni-prelaz-pavlovica-most-bih-srbija/", lat: 44.52, lon: 19.20 },
      { label: "Mali Zvornik", url: "https://uzivokamere.com/granicni-prelaz-mali-zvornik-kamera-srbija-bih/", lat: 44.37, lon: 19.12 },
      { label: "Kotroman / Vardište", url: "https://uzivokamere.com/granicni-prijelaz-kotroman-vardiste-srbija-bih/", lat: 44.15, lon: 19.05 },
      { label: "Karakaj", url: "https://uzivokamere.com/granicni-prelaz-karakaj-zvornik-bih-srbija/", lat: 44.38, lon: 19.10 },
      { label: "Šepak", url: "https://uzivokamere.com/granicni-prelaz-sepak-bih-srbija/", lat: 44.55, lon: 19.25 },
      { label: "Rača", url: "https://uzivokamere.com/granicni-prelaz-raca-bih-srbija/", lat: 45.00, lon: 19.35 },
    ],
    countries: ["BA", "RS"],
  },
  // Bosnia ↔ Montenegro
  {
    crossingCode: "BA-ME",
    cameras: [{ label: "Hum / Scepan Polje", url: "https://uzivokamere.com/granicni-prijelaz-hum-bih-crna-gora/", lat: 42.72, lon: 18.54 }],
    countries: ["BA", "ME"],
  },
  // Serbia ↔ Romania
  {
    crossingCode: "RO-RS",
    cameras: [{ label: "Vatin", url: "https://uzivokamere.com/granicni-prelaz-vatin-srbija-rumunija/", lat: 44.96, lon: 21.32 }],
    countries: ["RO", "RS"],
  },
];

function crossingKey(a: CountryCode, b: CountryCode): string {
  const codes = [a, b].sort();
  return `${codes[0]}-${codes[1]}`;
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
