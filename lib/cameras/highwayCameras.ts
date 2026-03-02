/**
 * Croatian highway cameras from HAK (Hrvatski Autoklub).
 *
 * Camera feeds: m.hak.hr/kamera.asp?g={group}&k={cameraId}
 *   g = highway group (controls navigation context)
 *   k = camera ID (global, determines which camera feed is shown)
 *
 * IDs verified against HAK's live camera index pages (March 2026).
 * Images refresh every ~60 seconds.
 */

export interface HighwayCamera {
  id: number;
  label: string;
  highway: string;
  lat: number;
  lon: number;
  url: string;
}

/**
 * HAK camera URL builder.
 * @param group - Highway group number (e.g. 1=A1, 7=A3, 12=A4)
 * @param cameraId - Global camera ID (k parameter)
 */
function hakUrl(group: number, cameraId: number): string {
  return `https://m.hak.hr/kamera.asp?g=${group}&k=${cameraId}`;
}

/**
 * All Croatian highway cameras.
 *
 * Group mapping:
 *   g=1  → A1 Zagreb–Split–Dubrovnik
 *   g=13 → A2 Zagreb–Macelj
 *   g=7  → A3 Bregana–Zagreb–Lipovac
 *   g=12 → A4 Zagreb–Goričan
 *   g=11 → A5 Beli Manastir–Osijek–BiH
 *   g=10 → A6 Rijeka–Zagreb
 *   g=9  → A7 Rupa–Rijeka
 *   g=6  → A8 Kanfanar–Matulji
 *   g=15 → A11 Zagreb–Sisak
 */
export const HIGHWAY_CAMERAS: HighwayCamera[] = [
  // ─── A1 (Zagreb – Split – Dubrovnik)  g=1 ───
  { id: 15,  label: "Lučko",              highway: "A1", lat: 45.7630, lon: 15.8980, url: hakUrl(1, 15) },
  { id: 53,  label: "Demerje",            highway: "A1", lat: 45.7140, lon: 15.8740, url: hakUrl(1, 53) },
  { id: 161, label: "Zdenčina",           highway: "A1", lat: 45.6840, lon: 15.7380, url: hakUrl(1, 161) },
  { id: 54,  label: "Jastrebarsko",       highway: "A1", lat: 45.6680, lon: 15.6420, url: hakUrl(1, 54) },
  { id: 12,  label: "Karlovac",           highway: "A1", lat: 45.4900, lon: 15.5470, url: hakUrl(1, 12) },
  { id: 70,  label: "Bosiljevo",          highway: "A1", lat: 45.3840, lon: 15.3930, url: hakUrl(1, 70) },
  { id: 257, label: "Ogulin",             highway: "A1", lat: 45.2650, lon: 15.2350, url: hakUrl(1, 257) },
  { id: 72,  label: "Brinje",             highway: "A1", lat: 45.0000, lon: 15.1300, url: hakUrl(1, 72) },
  { id: 79,  label: "Gospić",             highway: "A1", lat: 44.5460, lon: 15.3740, url: hakUrl(1, 79) },
  { id: 34,  label: "Sveti Rok",          highway: "A1", lat: 44.3670, lon: 15.4680, url: hakUrl(1, 34) },
  { id: 74,  label: "Maslenica",          highway: "A1", lat: 44.2340, lon: 15.5280, url: hakUrl(1, 74) },
  { id: 236, label: "Zadar",              highway: "A1", lat: 44.0960, lon: 15.5480, url: hakUrl(1, 236) },
  { id: 83,  label: "Šibenik",            highway: "A1", lat: 43.7510, lon: 15.9830, url: hakUrl(1, 83) },
  { id: 103, label: "Dugopolje (Split)",  highway: "A1", lat: 43.5740, lon: 16.5760, url: hakUrl(1, 103) },
  { id: 143, label: "Vrgorac",            highway: "A1", lat: 43.2060, lon: 17.3710, url: hakUrl(1, 143) },
  { id: 149, label: "Ploče",              highway: "A1", lat: 43.0490, lon: 17.3930, url: hakUrl(1, 149) },

  // ─── A2 (Zagreb – Macelj / Slovenian border)  g=13 ───
  { id: 134, label: "Zaprešić",           highway: "A2", lat: 45.8580, lon: 15.8090, url: hakUrl(13, 134) },
  { id: 132, label: "Krapina",            highway: "A2", lat: 46.1570, lon: 15.8730, url: hakUrl(13, 132) },
  { id: 133, label: "Trakoščan",          highway: "A2", lat: 46.2300, lon: 15.8780, url: hakUrl(13, 133) },
  { id: 16,  label: "Macelj",             highway: "A2", lat: 46.2660, lon: 15.8693, url: hakUrl(13, 16) },

  // ─── A3 (Bregana – Zagreb – Lipovac / Serbian border)  g=7 ───
  { id: 3,   label: "Bregana",            highway: "A3", lat: 45.8422, lon: 15.6993, url: hakUrl(7, 3) },
  { id: 229, label: "Samobor",            highway: "A3", lat: 45.8320, lon: 15.7290, url: hakUrl(7, 229) },
  { id: 231, label: "Jankomir",           highway: "A3", lat: 45.8170, lon: 15.8810, url: hakUrl(7, 231) },
  { id: 194, label: "Zagreb istok",       highway: "A3", lat: 45.8180, lon: 16.0580, url: hakUrl(7, 194) },
  { id: 212, label: "Ivanić Grad",        highway: "A3", lat: 45.7080, lon: 16.3930, url: hakUrl(7, 212) },
  { id: 114, label: "Kutina",             highway: "A3", lat: 45.4760, lon: 16.7850, url: hakUrl(7, 114) },
  { id: 241, label: "Novska",             highway: "A3", lat: 45.3420, lon: 16.9500, url: hakUrl(7, 241) },
  { id: 115, label: "Okučani",            highway: "A3", lat: 45.2980, lon: 17.1950, url: hakUrl(7, 115) },
  { id: 116, label: "Nova Gradiška",      highway: "A3", lat: 45.2540, lon: 17.3870, url: hakUrl(7, 116) },
  { id: 126, label: "Slavonski Brod zapad", highway: "A3", lat: 45.1570, lon: 18.0020, url: hakUrl(7, 126) },
  { id: 127, label: "Slavonski Brod istok", highway: "A3", lat: 45.1510, lon: 18.0980, url: hakUrl(7, 127) },
  { id: 129, label: "Velika Kopanica",    highway: "A3", lat: 45.1440, lon: 18.3770, url: hakUrl(7, 129) },
  { id: 128, label: "Županja",            highway: "A3", lat: 45.0780, lon: 18.6920, url: hakUrl(7, 128) },
  { id: 90,  label: "Lipovac",            highway: "A3", lat: 45.0700, lon: 19.0600, url: hakUrl(7, 90) },

  // ─── A4 (Zagreb – Goričan / Hungarian border)  g=12 ───
  { id: 226, label: "Zagreb istok (A4)",  highway: "A4", lat: 45.8300, lon: 16.0700, url: hakUrl(12, 226) },
  { id: 225, label: "Sesvete",            highway: "A4", lat: 45.8370, lon: 16.1120, url: hakUrl(12, 225) },
  { id: 108, label: "Sveta Helena",       highway: "A4", lat: 45.9560, lon: 16.2470, url: hakUrl(12, 108) },
  { id: 123, label: "Novi Marof",         highway: "A4", lat: 46.1540, lon: 16.3290, url: hakUrl(12, 123) },
  { id: 124, label: "Varaždin",           highway: "A4", lat: 46.3060, lon: 16.3370, url: hakUrl(12, 124) },
  { id: 214, label: "Ludbreg",            highway: "A4", lat: 46.2520, lon: 16.6180, url: hakUrl(12, 214) },
  { id: 125, label: "Čakovec",            highway: "A4", lat: 46.3850, lon: 16.4350, url: hakUrl(12, 125) },

  // ─── A5 (Beli Manastir – Osijek – Svilaj / Bosnian border)  g=11 ───
  { id: 270, label: "Beli Manastir",      highway: "A5", lat: 45.7710, lon: 18.6050, url: hakUrl(11, 270) },
  { id: 96,  label: "Osijek (A5)",        highway: "A5", lat: 45.5200, lon: 18.6370, url: hakUrl(11, 96) },
  { id: 95,  label: "Čepin",              highway: "A5", lat: 45.5100, lon: 18.5600, url: hakUrl(11, 95) },
  { id: 99,  label: "Đakovo",             highway: "A5", lat: 45.3080, lon: 18.4120, url: hakUrl(11, 99) },
  { id: 102, label: "Sredanci",           highway: "A5", lat: 45.1520, lon: 18.3340, url: hakUrl(11, 102) },
  { id: 245, label: "Svilaj",             highway: "A5", lat: 45.0255, lon: 17.9450, url: hakUrl(11, 245) },

  // ─── A6 (Rijeka – Bosiljevo)  g=10 ───
  { id: 65,  label: "Orehovica (Rijeka)", highway: "A6", lat: 45.3280, lon: 14.4420, url: hakUrl(10, 65) },
  { id: 48,  label: "Delnice",            highway: "A6", lat: 45.3960, lon: 14.8020, url: hakUrl(10, 48) },
  { id: 49,  label: "Vrbovsko",           highway: "A6", lat: 45.3730, lon: 15.0780, url: hakUrl(10, 49) },

  // ─── A7 (Rupa – Rijeka)  g=9 ───
  { id: 28,  label: "Rupa (A7)",          highway: "A7", lat: 45.4780, lon: 14.2860, url: hakUrl(9, 28) },
  { id: 68,  label: "Jurdani",            highway: "A7", lat: 45.3900, lon: 14.2700, url: hakUrl(9, 68) },
  { id: 26,  label: "Rijeka (A7)",        highway: "A7", lat: 45.3370, lon: 14.4090, url: hakUrl(9, 26) },

  // ─── A8 (Kanfanar – Matulji / Učka tunnel)  g=6 ───
  { id: 36,  label: "Učka tunel",         highway: "A8", lat: 45.2930, lon: 14.1780, url: hakUrl(6, 36) },

  // ─── A11 (Zagreb – Sisak)  g=15 ───
  { id: 220, label: "Velika Gorica",      highway: "A11", lat: 45.7090, lon: 16.0650, url: hakUrl(15, 220) },
  { id: 218, label: "Lekenik",            highway: "A11", lat: 45.5800, lon: 16.1680, url: hakUrl(15, 218) },
];

/** Get all highway cameras. */
export function getAllHighwayCameras(): HighwayCamera[] {
  return HIGHWAY_CAMERAS;
}

/** Get highway cameras filtered by highway name (e.g., "A1"). */
export function getHighwayCamerasByRoute(highway: string): HighwayCamera[] {
  return HIGHWAY_CAMERAS.filter((cam) => cam.highway === highway.toUpperCase());
}
