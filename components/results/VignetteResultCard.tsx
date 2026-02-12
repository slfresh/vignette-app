import { OFFICIAL_LINKS } from "@/lib/config/officialLinks";
import { PRICING_2026 } from "@/lib/config/pricing2026";
import type { CountryTravelSummary, VehicleClass, VignetteProduct } from "@/types/vignette";

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

const FLAGS: Record<string, string> = {
  DE: "DE",
  AT: "AT",
  CZ: "CZ",
  SK: "SK",
  HU: "HU",
  SI: "SI",
  CH: "CH",
  RO: "RO",
  BG: "BG",
  HR: "HR",
  RS: "RS",
  DK: "DK",
  SE: "SE",
  NL: "NL",
  BE: "BE",
  FR: "FR",
  IT: "IT",
  BA: "BA",
  ME: "ME",
  XK: "XK",
  MK: "MK",
  AL: "AL",
  PL: "PL",
  ES: "ES",
  PT: "PT",
  GB: "GB",
  IE: "IE",
  TR: "TR",
  GR: "GR",
};

function formatPrice(value: number, currency: string) {
  if (currency === "EUR") {
    return `${value.toFixed(2)} EUR`;
  }
  return `${value.toLocaleString("en-US")} ${currency}`;
}

function productMatchScore(product: VignetteProduct, vehicleClass: VehicleClass): number {
  if (!product.vehicleTags?.length) {
    return 1;
  }
  return product.vehicleTags.includes(vehicleClass) ? 3 : 0;
}

function getCamperCaution(countryCode: string, vehicleClass: VehicleClass): string | null {
  if (vehicleClass !== "VAN_OR_MPV" && vehicleClass !== "COMMERCIAL_N1") {
    return null;
  }

  if (countryCode === "SI") {
    return "Camper vans can be class 2B in Slovenia. Verify first-axle height before purchase.";
  }
  if (countryCode === "HU") {
    return "Camper vans in Hungary may require D2 category instead of D1.";
  }
  if (countryCode === "AT") {
    return "Heavier camper vehicles in Austria can move to separate toll systems above 3.5t.";
  }
  if (countryCode === "CH") {
    return "Camper vehicles in Switzerland can trigger separate heavy-vehicle obligations by weight.";
  }

  return null;
}

function formatVehicleLabel(vehicleClass: VehicleClass): string {
  if (vehicleClass === "MOTORCYCLE") {
    return "Motorcycle";
  }
  if (vehicleClass === "VAN_OR_MPV" || vehicleClass === "COMMERCIAL_N1") {
    return "Camper van / RV";
  }
  return "Car";
}

export function VignetteResultCard({ country, vehicleClass = "PASSENGER_CAR_M1" }: { country: CountryTravelSummary; vehicleClass?: VehicleClass }) {
  const pricing = PRICING_2026[country.countryCode];
  const officialUrl = OFFICIAL_LINKS[country.countryCode];
  const prioritizedProducts = (pricing?.products ?? [])
    .map((product) => ({ product, score: productMatchScore(product, vehicleClass) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.product);
  const visibleProducts = (prioritizedProducts.length ? prioritizedProducts : pricing?.products ?? []).slice(0, 4);
  const camperCaution = getCamperCaution(country.countryCode, vehicleClass);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-900">
          {COUNTRY_NAMES[country.countryCode]} <span className="text-sm text-zinc-500">({FLAGS[country.countryCode]})</span>
        </h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${country.requiresVignette ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
          {country.requiresVignette ? "Vignette needed" : "No vignette needed"}
        </span>
      </header>

      <p className="mt-2 text-sm text-zinc-600">Estimated highway distance: {(country.highwayDistanceMeters / 1000).toFixed(1)} km</p>

      {camperCaution ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{camperCaution}</p> : null}

      {visibleProducts.length ? (
        <>
          <p className="mt-3 text-xs font-medium text-zinc-600">Prices shown for: {formatVehicleLabel(vehicleClass)}</p>
          <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="py-1">Product</th>
              <th className="py-1">Price</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((product) => (
              <tr key={product.id} className="border-t border-zinc-100">
                <td className="py-1 pr-2 text-zinc-800">{product.label}</td>
                <td className="py-1 text-zinc-700">{formatPrice(product.price, product.currency)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </>
      ) : (
        <p className="mt-3 rounded-md bg-zinc-50 p-2 text-sm text-zinc-700">No standard passenger car national vignette price table.</p>
      )}

      {country.notices.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {country.notices.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      ) : null}

      <a
        className="mt-4 inline-block rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        href={officialUrl}
        target="_blank"
        rel="noreferrer noopener"
      >
        Buy on official site
      </a>
    </article>
  );
}
