import { useI18n } from "@/components/i18n/I18nProvider";
import { COUNTRY_NAMES } from "@/lib/config/countryNames";
import type { CountryCode, CountryTravelSummary } from "@/types/vignette";
import { TOLLS_AVOIDED_NOTICE } from "@/lib/config/countryRules";

/** Traffic light: green=free, yellow=toll, red=vignette */
function StatusDot({ tone }: { tone: "vignette" | "toll" | "free" }) {
  const bg =
    tone === "vignette"
      ? "bg-red-500"
      : tone === "toll"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${bg}`} aria-hidden />;
}

function CountryChip({
  code,
  tone,
  suffix,
  onClick,
}: {
  code: string;
  tone: "vignette" | "toll" | "free";
  suffix?: string;
  onClick?: () => void;
}) {
  const classes =
    tone === "vignette"
      ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      : tone === "toll"
        ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";

  const content = (
    <>
      <StatusDot tone={tone} />
      <span>
        {COUNTRY_NAMES[code] ?? code} ({code})
        {suffix ? ` – ${suffix}` : ""}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${classes}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>
      {content}
    </span>
  );
}

function getTone(country: CountryTravelSummary): "vignette" | "toll" | "free" {
  if (country.requiresVignette) return "vignette";
  if (country.requiresSectionToll || country.notices.includes(TOLLS_AVOIDED_NOTICE)) return "toll";
  return "free";
}

export function RouteCountrySummary({
  countries,
  onCountryClick,
}: {
  countries: CountryTravelSummary[];
  onCountryClick?: (code: CountryCode) => void;
}) {
  const { t } = useI18n();
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
      <h3 className="text-lg font-semibold text-zinc-900">{t("summary.title")}</h3>

      {/* Route order with traffic lights – click to jump to card */}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("summary.routeOrder")}</p>
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <CountryChip
              key={country.countryCode}
              code={country.countryCode}
              tone={getTone(country)}
              suffix={country.notices.includes(TOLLS_AVOIDED_NOTICE) ? t("summary.tollsAvoided") : undefined}
              onClick={onCountryClick ? () => onCountryClick(country.countryCode) : undefined}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4">
        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">{t("summary.vignetteCountries")}</p>
          <div className="flex flex-wrap gap-2">
            {vignetteCountries.length ? (
              vignetteCountries.map((country) => (
                <CountryChip
                  key={country.countryCode}
                  code={country.countryCode}
                  tone="vignette"
                  onClick={onCountryClick ? () => onCountryClick(country.countryCode) : undefined}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">{t("summary.noneDetected")}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">{t("summary.tollCountries")}</p>
          <div className="flex flex-wrap gap-2">
            {tollCountries.length ? (
              tollCountries.map((country) => (
                <CountryChip
                  key={country.countryCode}
                  code={country.countryCode}
                  tone="toll"
                  suffix={country.notices.includes(TOLLS_AVOIDED_NOTICE) ? t("summary.tollsAvoided") : undefined}
                  onClick={onCountryClick ? () => onCountryClick(country.countryCode) : undefined}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">{t("summary.noneDetected")}</p>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-zinc-800">{t("summary.noFeeCountries")}</p>
          <div className="flex flex-wrap gap-2">
            {freeCountries.length ? (
              freeCountries.map((country) => (
                <CountryChip
                  key={country.countryCode}
                  code={country.countryCode}
                  tone="free"
                  onClick={onCountryClick ? () => onCountryClick(country.countryCode) : undefined}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-500">{t("summary.noneDetected")}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
