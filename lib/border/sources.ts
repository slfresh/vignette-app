import type { CountryCode } from "@/types/vignette";

export type BorderSource = {
  crossingCode: string;
  crossingLabel: string;
  label: string;
  url: string;
  priority: number;
  kind: "official" | "aggregated";
};

export const BORDER_WAIT_LINKS: Partial<Record<CountryCode, { label: string; url: string }>> = {
  HU: { label: "Hungary border traffic (Police.hu)", url: "https://www.police.hu/en/content/border-information" },
  RS: { label: "Serbia traffic info (AMSS)", url: "https://www.amss.org.rs/en" },
  BG: { label: "Bulgaria border crossing info", url: "https://www.mvr.bg/en" },
  RO: { label: "Romania border traffic", url: "https://www.politiadefrontiera.ro/en/main/traficonline-traffic-on-road-checkpoints-open-for-the-international-traffic-92.html" },
  TR: { label: "Turkey border gate status", url: "https://www.mfa.gov.tr/" },
};

export const CROSSING_SOURCES: Record<string, BorderSource[]> = {
  "HU-RS": [
    {
      crossingCode: "HU-RS",
      crossingLabel: "HU-RS (Roszke / Horgos)",
      label: "Official wait times (Police.hu Hatarinfo)",
      url: "https://www.police.hu/hu/hirek-es-informaciok/hatarinfo",
      priority: 1,
      kind: "official",
    },
    {
      crossingCode: "HU-RS",
      crossingLabel: "HU-RS (Roszke / Horgos)",
      label: "Live cameras (AMSS / Serbian road cameras)",
      url: "https://www.amss.org.rs/stanje-na-putevima/kamere",
      priority: 2,
      kind: "aggregated",
    },
  ],
  "RS-BG": [
    {
      crossingCode: "RS-BG",
      crossingLabel: "RS-BG (Gradina / Kalotina)",
      label: "Live cameras (AMSS - Gradina corridor)",
      url: "https://www.amss.org.rs/stanje-na-putevima/kamere",
      priority: 1,
      kind: "aggregated",
    },
  ],
  "BG-TR": [
    {
      crossingCode: "BG-TR",
      crossingLabel: "BG-TR (Kapikule / Hamzabeyli)",
      label: "Official customs region sources (Trakya)",
      url: "https://trakya.gtb.gov.tr/",
      priority: 1,
      kind: "official",
    },
    {
      crossingCode: "BG-TR",
      crossingLabel: "BG-TR (Kapikule / Hamzabeyli)",
      label: "Live camera aggregator (border streams)",
      url: "https://www.uzivokamere.com/granicni-prelazi",
      priority: 2,
      kind: "aggregated",
    },
  ],
};

export function getBorderWaitSources(routeCountries: CountryCode[]): Array<{ countryCode: CountryCode; label: string; url: string }> {
  const unique = Array.from(new Set(routeCountries));
  return unique
    .map((countryCode) => {
      const entry = BORDER_WAIT_LINKS[countryCode];
      if (!entry) {
        return null;
      }
      return {
        countryCode,
        ...entry,
      };
    })
    .filter((entry): entry is { countryCode: CountryCode; label: string; url: string } => Boolean(entry));
}

function getCrossingKey(first: CountryCode, second: CountryCode): string | null {
  const direct = `${first}-${second}`;
  if (CROSSING_SOURCES[direct]) {
    return direct;
  }
  const reverse = `${second}-${first}`;
  if (CROSSING_SOURCES[reverse]) {
    return reverse;
  }
  return null;
}

export function getRouteCrossingSources(routeCountries: CountryCode[]): BorderSource[] {
  if (routeCountries.length < 2) {
    return [];
  }

  const output: BorderSource[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < routeCountries.length - 1; index += 1) {
    const current = routeCountries[index];
    const next = routeCountries[index + 1];
    if (current === next) {
      continue;
    }

    const crossingKey = getCrossingKey(current, next);
    if (!crossingKey) {
      continue;
    }

    const sources = CROSSING_SOURCES[crossingKey] ?? [];
    for (const source of sources) {
      const uniqueKey = `${crossingKey}-${source.url}`;
      if (seen.has(uniqueKey)) {
        continue;
      }
      seen.add(uniqueKey);
      output.push(source);
    }
  }

  return output.sort((left, right) => left.priority - right.priority);
}
