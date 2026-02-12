import type { CountryTravelSummary } from "@/types/vignette";
import { TOLLS_AVOIDED_NOTICE } from "@/lib/config/countryRules";

const COUNTRY_NAMES: Record<string, string> = {
  DE: "Germany",
  AT: "Austria",
  CZ: "Czech Republic",
  SK: "Slovakia",
  HU: "Hungary",
  SI: "Slovenia",
  CH: "Switzerland",
  RO: "Romania",
  BG: "Bulgaria",
  HR: "Croatia",
  RS: "Serbia",
  DK: "Denmark",
  SE: "Sweden",
  NL: "Netherlands",
  BE: "Belgium",
  FR: "France",
  IT: "Italy",
  BA: "Bosnia and Herzegovina",
  ME: "Montenegro",
  XK: "Kosovo",
  MK: "North Macedonia",
  AL: "Albania",
  PL: "Poland",
  ES: "Spain",
  PT: "Portugal",
  GB: "United Kingdom",
  IE: "Ireland",
  TR: "Turkey",
  GR: "Greece",
};

function CountryChip({ code, tone, suffix }: { code: string; tone: "vignette" | "toll" | "free"; suffix?: string }) {
  const classes =
    tone === "vignette"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "toll"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
      {COUNTRY_NAMES[code] ?? code} ({code})
      {suffix ? ` - ${suffix}` : ""}
    </span>
  );
}

export function RouteCountrySummary({ countries }: { countries: CountryTravelSummary[] }) {
  const vignetteCountries = countries.filter((country) => country.requiresVignette);
  const tollCountries = countries.filter(
    (country) => !country.requiresVignette && (country.requiresSectionToll || country.notices.includes(TOLLS_AVOIDED_NOTICE)),
  );
  const freeCountries = countries.filter(
    (country) =>
      !country.requiresVignette &&
      !country.requiresSectionToll &&
      !country.notices.includes(TOLLS_AVOIDED_NOTICE),
  );

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Route summary by country</h3>
      <div className="mt-3 grid gap-3">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">Vignette countries</p>
          <div className="flex flex-wrap gap-2">
            {vignetteCountries.length ? (
              vignetteCountries.map((country) => <CountryChip key={country.countryCode} code={country.countryCode} tone="vignette" />)
            ) : (
              <p className="text-sm text-zinc-500">None detected on this route.</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">Toll countries</p>
          <div className="flex flex-wrap gap-2">
            {tollCountries.length ? (
              tollCountries.map((country) => (
                <CountryChip
                  key={country.countryCode}
                  code={country.countryCode}
                  tone="toll"
                  suffix={country.notices.includes(TOLLS_AVOIDED_NOTICE) ? "Tolls avoided" : undefined}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">None detected on this route.</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">No-fee countries (national level)</p>
          <div className="flex flex-wrap gap-2">
            {freeCountries.length ? (
              freeCountries.map((country) => <CountryChip key={country.countryCode} code={country.countryCode} tone="free" />)
            ) : (
              <p className="text-sm text-zinc-500">None detected on this route.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
