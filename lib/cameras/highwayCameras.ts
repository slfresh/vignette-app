/**
 * Croatian highway cameras from HAK (Hrvatski Autoklub).
 *
 * Camera feeds: m.hak.hr/kamera.asp?g={group}&k={cameraId}
 *   g = highway group (controls navigation context)
 *   k = camera ID (global, determines which camera feed is shown)
 *
 * IDs verified against HAK's live camera index pages (March 2026).
 * Coordinates sourced from OpenStreetMap toll booth nodes (barrier=toll_booth).
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
  // Coordinates from OSM toll booth nodes (barrier=toll_booth, operator=HAC/ARZ)
  { id: 15,  label: "Lučko",              highway: "A1", lat: 45.7490, lon: 15.8841, url: hakUrl(1, 15) },
  { id: 53,  label: "Demerje",            highway: "A1", lat: 45.7236, lon: 15.8702, url: hakUrl(1, 53) },
  { id: 161, label: "Zdenčina",           highway: "A1", lat: 45.6751, lon: 15.7565, url: hakUrl(1, 161) },
  { id: 54,  label: "Jastrebarsko",       highway: "A1", lat: 45.6459, lon: 15.6769, url: hakUrl(1, 54) },
  { id: 12,  label: "Karlovac",           highway: "A1", lat: 45.5121, lon: 15.5486, url: hakUrl(1, 12) },
  { id: 70,  label: "Bosiljevo",          highway: "A1", lat: 45.4179, lon: 15.2916, url: hakUrl(1, 70) },
  { id: 257, label: "Ogulin",             highway: "A1", lat: 45.2360, lon: 15.2639, url: hakUrl(1, 257) },
  { id: 72,  label: "Brinje",             highway: "A1", lat: 45.0256, lon: 15.1604, url: hakUrl(1, 72) },
  { id: 79,  label: "Gospić",             highway: "A1", lat: 44.5736, lon: 15.4222, url: hakUrl(1, 79) },
  { id: 34,  label: "Sveti Rok",          highway: "A1", lat: 44.3884, lon: 15.6283, url: hakUrl(1, 34) },
  { id: 74,  label: "Maslenica",          highway: "A1", lat: 44.2401, lon: 15.5323, url: hakUrl(1, 74) },
  { id: 236, label: "Zadar",              highway: "A1", lat: 44.1148, lon: 15.4370, url: hakUrl(1, 236) },
  { id: 83,  label: "Šibenik",            highway: "A1", lat: 43.7587, lon: 15.9338, url: hakUrl(1, 83) },
  { id: 103, label: "Dugopolje (Split)",  highway: "A1", lat: 43.5958, lon: 16.5711, url: hakUrl(1, 103) },
  { id: 143, label: "Vrgorac",            highway: "A1", lat: 43.2184, lon: 17.2681, url: hakUrl(1, 143) },
  { id: 149, label: "Ploče",              highway: "A1", lat: 43.1192, lon: 17.5478, url: hakUrl(1, 149) },

  // ─── A2 (Zagreb – Macelj / Slovenian border)  g=13 ───
  { id: 134, label: "Zaprešić",           highway: "A2", lat: 45.8747, lon: 15.8301, url: hakUrl(13, 134) },
  { id: 132, label: "Krapina",            highway: "A2", lat: 46.1335, lon: 15.8832, url: hakUrl(13, 132) },
  { id: 133, label: "Trakoščan",          highway: "A2", lat: 46.2601, lon: 15.8590, url: hakUrl(13, 133) },
  { id: 16,  label: "Macelj",             highway: "A2", lat: 46.2660, lon: 15.8693, url: hakUrl(13, 16) },

  // ─── A3 (Bregana – Zagreb – Lipovac / Serbian border)  g=7 ───
  { id: 3,   label: "Bregana",            highway: "A3", lat: 45.8392, lon: 15.7046, url: hakUrl(7, 3) },
  { id: 229, label: "Samobor",            highway: "A3", lat: 45.8350, lon: 15.7300, url: hakUrl(7, 229) },
  { id: 231, label: "Jankomir",           highway: "A3", lat: 45.8100, lon: 15.8750, url: hakUrl(7, 231) },
  { id: 194, label: "Zagreb istok",       highway: "A3", lat: 45.7539, lon: 16.2744, url: hakUrl(7, 194) },
  { id: 212, label: "Ivanić Grad",        highway: "A3", lat: 45.6907, lon: 16.3909, url: hakUrl(7, 212) },
  { id: 114, label: "Kutina",             highway: "A3", lat: 45.4622, lon: 16.7676, url: hakUrl(7, 114) },
  { id: 241, label: "Novska",             highway: "A3", lat: 45.3316, lon: 16.9478, url: hakUrl(7, 241) },
  { id: 115, label: "Okučani",            highway: "A3", lat: 45.2144, lon: 17.2099, url: hakUrl(7, 115) },
  { id: 116, label: "Nova Gradiška",      highway: "A3", lat: 45.2319, lon: 17.4117, url: hakUrl(7, 116) },
  { id: 126, label: "Slavonski Brod zapad", highway: "A3", lat: 45.1685, lon: 17.9452, url: hakUrl(7, 126) },
  { id: 127, label: "Slavonski Brod istok", highway: "A3", lat: 45.1745, lon: 18.0657, url: hakUrl(7, 127) },
  { id: 129, label: "Velika Kopanica",    highway: "A3", lat: 45.1354, lon: 18.4085, url: hakUrl(7, 129) },
  { id: 128, label: "Županja",            highway: "A3", lat: 45.1052, lon: 18.7131, url: hakUrl(7, 128) },
  { id: 90,  label: "Lipovac",            highway: "A3", lat: 45.0469, lon: 19.0241, url: hakUrl(7, 90) },

  // ─── A4 (Zagreb – Goričan / Hungarian border)  g=12 ───
  { id: 226, label: "Zagreb istok (A4)",  highway: "A4", lat: 45.8240, lon: 16.0930, url: hakUrl(12, 226) },
  { id: 225, label: "Sesvete",            highway: "A4", lat: 45.8450, lon: 16.1300, url: hakUrl(12, 225) },
  { id: 108, label: "Sveta Helena",       highway: "A4", lat: 45.9205, lon: 16.2737, url: hakUrl(12, 108) },
  { id: 123, label: "Novi Marof",         highway: "A4", lat: 46.1503, lon: 16.3649, url: hakUrl(12, 123) },
  { id: 124, label: "Varaždin",           highway: "A4", lat: 46.2626, lon: 16.3957, url: hakUrl(12, 124) },
  { id: 214, label: "Ludbreg",            highway: "A4", lat: 46.2834, lon: 16.4851, url: hakUrl(12, 214) },
  { id: 125, label: "Čakovec",            highway: "A4", lat: 46.3501, lon: 16.5298, url: hakUrl(12, 125) },

  // ─── A5 (Beli Manastir – Osijek – Svilaj / Bosnian border)  g=11 ───
  { id: 270, label: "Beli Manastir",      highway: "A5", lat: 45.7580, lon: 18.6170, url: hakUrl(11, 270) },
  { id: 96,  label: "Osijek (A5)",        highway: "A5", lat: 45.5460, lon: 18.6050, url: hakUrl(11, 96) },
  { id: 95,  label: "Čepin",              highway: "A5", lat: 45.5044, lon: 18.5126, url: hakUrl(11, 95) },
  { id: 99,  label: "Đakovo",             highway: "A5", lat: 45.3244, lon: 18.3847, url: hakUrl(11, 99) },
  { id: 102, label: "Sredanci",           highway: "A5", lat: 45.1680, lon: 18.3420, url: hakUrl(11, 102) },
  { id: 245, label: "Svilaj",             highway: "A5", lat: 45.0380, lon: 18.4900, url: hakUrl(11, 245) },

  // ─── A6 (Rijeka – Bosiljevo)  g=10 ───
  { id: 65,  label: "Orehovica (Rijeka)", highway: "A6", lat: 45.3480, lon: 14.4330, url: hakUrl(10, 65) },
  { id: 48,  label: "Delnice",            highway: "A6", lat: 45.3890, lon: 14.7560, url: hakUrl(10, 48) },
  { id: 49,  label: "Vrbovsko",           highway: "A6", lat: 45.3624, lon: 15.0864, url: hakUrl(10, 49) },

  // ─── A7 (Rupa – Rijeka)  g=9 ───
  { id: 28,  label: "Rupa (A7)",          highway: "A7", lat: 45.4780, lon: 14.2860, url: hakUrl(9, 28) },
  { id: 68,  label: "Jurdani",            highway: "A7", lat: 45.3900, lon: 14.2700, url: hakUrl(9, 68) },
  { id: 26,  label: "Rijeka (A7)",        highway: "A7", lat: 45.3370, lon: 14.4090, url: hakUrl(9, 26) },

  // ─── A8 (Kanfanar – Matulji / Učka tunnel)  g=6 ───
  { id: 36,  label: "Učka tunel",         highway: "A8", lat: 45.2930, lon: 14.1780, url: hakUrl(6, 36) },

  // ─── A11 (Zagreb – Sisak)  g=15 ───
  { id: 220, label: "Velika Gorica",      highway: "A11", lat: 45.6644, lon: 16.0760, url: hakUrl(15, 220) },
  { id: 218, label: "Lekenik",            highway: "A11", lat: 45.6222, lon: 16.1086, url: hakUrl(15, 218) },
];

/** Get all highway cameras. */
export function getAllHighwayCameras(): HighwayCamera[] {
  return HIGHWAY_CAMERAS;
}

/** Get highway cameras filtered by highway name (e.g., "A1"). */
export function getHighwayCamerasByRoute(highway: string): HighwayCamera[] {
  return HIGHWAY_CAMERAS.filter((cam) => cam.highway === highway.toUpperCase());
}
