import type { CountryCode, CountryTravelSummary, RouteAnalysisRequest, SectionTollNotice } from "@/types/vignette";
import { SECTION_TOLL_LINKS } from "@/lib/config/officialLinks";

export const ORS_COUNTRY_ID_MAP: Record<number, CountryCode> = {
  2: "AL",
  11: "AT",
  17: "BE",
  23: "BA",
  30: "BG",
  49: "HR",
  52: "CZ",
  53: "DK",
  70: "FR",
  74: "DE",
  78: "GR",
  88: "HU",
  94: "IE",
  97: "IT",
  106: "XK",
  118: "MK",
  132: "ME",
  159: "PL",
  160: "PT",
  162: "RO",
  175: "RS",
  179: "SK",
  180: "SI",
  187: "ES",
  192: "SE",
  193: "CH",
  200: "NL",
  206: "TR",
  213: "GB",
  // Keep legacy aliases because ORS datasets can vary by release.
  186: "RO",
  204: "SK",
  205: "SI",
};

export const HIGHWAY_CATEGORIES = new Set([1, 3]);
export const TOLLWAY_CATEGORIES = new Set([2, 3]);
const LONDON_REGEX = /\blondon\b/i;
export const TOLLS_AVOIDED_NOTICE = "Tolls avoided where possible on this route.";

function resolveTollCountryRequirement(
  hasHighway: boolean,
  hasTollway: boolean,
  request: RouteAnalysisRequest,
  notices: string[],
): boolean {
  if (request.avoidTolls && hasHighway && !hasTollway) {
    notices.push(TOLLS_AVOIDED_NOTICE);
    return false;
  }
  return hasHighway || hasTollway;
}

function appendVehicleSpecificNotices(countryCode: CountryCode, request: RouteAnalysisRequest, notices: string[]) {
  if (request.vehicleClass === "MOTORCYCLE") {
    if (countryCode === "AT") {
      notices.push("Motorcycle tariffs differ from car tariffs in Austria.");
    } else if (countryCode === "HU") {
      notices.push("Hungary often uses a separate motorcycle category (D1M).");
    } else if (countryCode === "SI") {
      notices.push("Slovenia motorcycles have a separate class with different pricing.");
    }
    return;
  }

  if (request.vehicleClass === "VAN_OR_MPV" || request.vehicleClass === "COMMERCIAL_N1") {
    if (countryCode === "SI") {
      notices.push("Camper vans can fall into Slovenia class 2B based on first-axle height.");
    } else if (countryCode === "HU") {
      notices.push("Camper vans can be categorized as D2/N1 in Hungary with higher fees.");
    } else if (countryCode === "AT") {
      notices.push("Vehicles over 3.5t in Austria use separate heavy-vehicle toll systems.");
    } else if (countryCode === "CH") {
      notices.push("Heavier camper vehicles in Switzerland can fall under separate heavy-vehicle rules.");
    }
  }
}

export function evaluateCountryRequirement(
  countryCode: CountryCode,
  hasHighway: boolean,
  hasTollway: boolean,
  request: RouteAnalysisRequest,
): Pick<CountryTravelSummary, "requiresVignette" | "requiresSectionToll" | "notices"> {
  const notices: string[] = [];
  const routeText = `${request.start} ${request.end}`;
  appendVehicleSpecificNotices(countryCode, request, notices);

  switch (countryCode) {
    case "DE":
      return {
        requiresVignette: false,
        requiresSectionToll: false,
        notices: [
          "No passenger-car national vignette requirement.",
          "Environmental sticker (Umweltplakette) can be required for city low-emission zones.",
        ],
      };
    case "AT":
      if (hasHighway) {
        notices.push("Digital 2-month and annual products may not start immediately in some flows.");
      }
      if (hasTollway) {
        notices.push("Section toll routes in Austria can require additional payment.");
      }
      return { requiresVignette: hasHighway, requiresSectionToll: hasTollway, notices };
    case "CZ":
      notices.push("Foreign EV exemptions may require pre-submitted documents.");
      return { requiresVignette: hasHighway, requiresSectionToll: false, notices };
    case "SK":
      notices.push("10-day can be better value than two 1-day products.");
      return { requiresVignette: hasHighway, requiresSectionToll: false, notices };
    case "HU":
      notices.push("Check D1 vs D2 category using registration class and seat count.");
      if ((request.seats ?? 0) > 7 || request.vehicleClass === "COMMERCIAL_N1") {
        notices.push("Your inputs may indicate D2 pricing.");
      }
      return { requiresVignette: hasHighway, requiresSectionToll: false, notices };
    case "SI":
      notices.push("Vehicles >= 1.3m at first axle may be class 2B with higher price.");
      return { requiresVignette: hasHighway, requiresSectionToll: false, notices };
    case "CH":
      notices.push("Switzerland generally requires annual vignette for national roads.");
      return { requiresVignette: hasHighway || hasTollway, requiresSectionToll: false, notices };
    case "RO":
      notices.push("Bridge tolls can be separate from the network vignette.");
      return { requiresVignette: hasHighway, requiresSectionToll: hasTollway, notices };
    case "BG": {
      const weekday = request.dateISO ? new Date(request.dateISO).getUTCDay() : null;
      if (weekday === 5 || weekday === 6 || weekday === 0) {
        notices.push("Weekend vignette may be cost-effective for short trips.");
      }
      return { requiresVignette: hasHighway, requiresSectionToll: false, notices };
    }
    case "HR":
      notices.push("Croatia uses distance-based motorway toll collection (no national car vignette).");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "RS":
      notices.push("Serbia uses distance-based toll plazas on major corridors (no national car vignette).");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "DK":
      notices.push("No national vignette for cars, but Oresund and Storebaelt crossings are tolled.");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "SE":
      notices.push("No national vignette for cars; Oresund crossing from Denmark is tolled.");
      return { requiresVignette: false, requiresSectionToll: hasTollway, notices };
    case "NL":
      notices.push("No national passenger-car vignette on regular routes.");
      return { requiresVignette: false, requiresSectionToll: false, notices };
    case "BE":
      notices.push("No national passenger-car vignette on regular routes.");
      return { requiresVignette: false, requiresSectionToll: false, notices };
    case "FR":
      notices.push("France motorways are usually distance-tolled instead of vignette-based.");
      notices.push("Crit'Air environmental sticker can be required in French low-emission zones (ZFE).");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "IT":
      notices.push("Italy motorways are usually distance-tolled instead of vignette-based.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "BA":
      notices.push("Bosnia and Herzegovina has toll sections on selected motorway corridors.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "ME":
      notices.push("Montenegro has no national vignette; selected roads/tunnels can be tolled.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "XK":
      notices.push("Kosovo has no standard national passenger-car vignette.");
      return { requiresVignette: false, requiresSectionToll: false, notices };
    case "MK":
      notices.push("North Macedonia commonly uses toll plazas on major motorways.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "AL":
      notices.push("Albania has no national vignette; selected motorways may be tolled.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "PL":
      notices.push("Poland has no national passenger-car vignette; selected motorway sections are tolled.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "ES":
      notices.push("Spain has no national passenger-car vignette; selected autopista routes are tolled.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "PT":
      notices.push("Portugal has no national passenger-car vignette; electronic tolling exists on selected motorways.");
      return { requiresVignette: false, requiresSectionToll: resolveTollCountryRequirement(hasHighway, hasTollway, request, notices), notices };
    case "GB":
      notices.push("United Kingdom has no national passenger-car vignette; selected crossings and roads are tolled.");
      if (LONDON_REGEX.test(routeText)) {
        notices.push("London driving can require ULEZ and Congestion Charge payments.");
      }
      if (request.channelCrossingPreference === "tunnel") {
        notices.push("Channel preference set to Eurotunnel for booking guidance.");
      } else if (request.channelCrossingPreference === "ferry") {
        notices.push("Channel preference set to ferry (compare sailing times and booking requirements).");
      }
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "IE":
      notices.push("Ireland has no national passenger-car vignette; selected motorways and urban crossings are tolled.");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "TR":
      notices.push("Turkey uses HGS/OGS toll systems on major motorways and bridges.");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    case "GR":
      notices.push("Greece uses toll plazas on major motorway corridors.");
      return { requiresVignette: false, requiresSectionToll: hasHighway || hasTollway, notices };
    default:
      return { requiresVignette: hasHighway, requiresSectionToll: hasTollway, notices };
  }
}

export function getSectionTollNotices(
  countryCode: CountryCode,
  request?: RouteAnalysisRequest,
  routeCountries: CountryCode[] = [],
): SectionTollNotice[] {
  if (countryCode === "AT") {
    return [
      {
        countryCode,
        label: "Austria Section Toll",
        description: "Specific alpine sections (e.g. Brenner, Tauern) can require extra tolls.",
        officialUrl: SECTION_TOLL_LINKS.AT,
      },
    ];
  }

  if (countryCode === "RO") {
    return [
      {
        countryCode,
        label: "Romania Bridge Toll",
        description: "Major Danube bridge crossings can require separate peaj payment.",
        officialUrl: SECTION_TOLL_LINKS.RO,
      },
    ];
  }

  if (countryCode === "DK") {
    return [
      {
        countryCode,
        label: "Denmark Bridge Toll",
        description: "Major crossings like Storebaelt and Oresund can require separate bridge toll payments.",
        officialUrl: SECTION_TOLL_LINKS.DK,
      },
    ];
  }

  if (countryCode === "SE") {
    return [
      {
        countryCode,
        label: "Sweden Oresund Crossing",
        description: "Driving between Denmark and Sweden via Oresund requires a bridge toll.",
        officialUrl: SECTION_TOLL_LINKS.SE,
      },
    ];
  }

  if (countryCode === "HR") {
    return [
      {
        countryCode,
        label: "Croatia Motorway Toll",
        description: "Croatia motorways are typically paid by distance at toll points or digital channels.",
        officialUrl: SECTION_TOLL_LINKS.HR,
      },
    ];
  }

  if (countryCode === "RS") {
    return [
      {
        countryCode,
        label: "Serbia Motorway Toll",
        description: "Serbia motorways commonly use distance-based toll plazas on transit routes.",
        officialUrl: SECTION_TOLL_LINKS.RS,
      },
    ];
  }

  if (countryCode === "FR") {
    return [
      {
        countryCode,
        label: "France Motorway Toll",
        description: "Most French autoroutes are toll roads with distance-based pricing.",
        officialUrl: SECTION_TOLL_LINKS.FR,
      },
    ];
  }

  if (countryCode === "IT") {
    return [
      {
        countryCode,
        label: "Italy Motorway Toll",
        description: "Most Italian autostrade use distance-based tolling.",
        officialUrl: SECTION_TOLL_LINKS.IT,
      },
    ];
  }

  if (countryCode === "BA") {
    return [
      {
        countryCode,
        label: "Bosnia and Herzegovina Toll",
        description: "Selected motorway sections are tolled.",
        officialUrl: SECTION_TOLL_LINKS.BA,
      },
    ];
  }

  if (countryCode === "ME") {
    return [
      {
        countryCode,
        label: "Montenegro Road Toll",
        description: "Some roads and tunnels in Montenegro can require toll payments.",
        officialUrl: SECTION_TOLL_LINKS.ME,
      },
    ];
  }

  if (countryCode === "MK") {
    return [
      {
        countryCode,
        label: "North Macedonia Toll",
        description: "North Macedonia uses toll plazas on major motorway segments.",
        officialUrl: SECTION_TOLL_LINKS.MK,
      },
    ];
  }

  if (countryCode === "AL") {
    return [
      {
        countryCode,
        label: "Albania Road Toll",
        description: "Selected Albanian motorway corridors can require toll payments.",
        officialUrl: SECTION_TOLL_LINKS.AL,
      },
    ];
  }

  if (countryCode === "PL") {
    return [
      {
        countryCode,
        label: "Poland Motorway Toll",
        description: "Selected Polish motorway sections are tolled for passenger cars.",
        officialUrl: SECTION_TOLL_LINKS.PL,
      },
    ];
  }

  if (countryCode === "ES") {
    return [
      {
        countryCode,
        label: "Spain Motorway Toll",
        description: "Selected Spanish autopista corridors use toll pricing.",
        officialUrl: SECTION_TOLL_LINKS.ES,
      },
    ];
  }

  if (countryCode === "PT") {
    return [
      {
        countryCode,
        label: "Portugal Electronic Toll",
        description: "Selected Portuguese motorways use electronic toll collection.",
        officialUrl: SECTION_TOLL_LINKS.PT,
      },
    ];
  }

  if (countryCode === "GB") {
    const notices: SectionTollNotice[] = [
      {
        countryCode,
        label: "United Kingdom Toll",
        description: "Selected UK crossings and routes (e.g. Dartford) require toll payment.",
        officialUrl: SECTION_TOLL_LINKS.GB,
      },
    ];

    const routeText = `${request?.start ?? ""} ${request?.end ?? ""}`;
    if (LONDON_REGEX.test(routeText)) {
      notices.push({
        countryCode,
        label: "London ULEZ/Congestion",
        description: "Driving in London can require ULEZ and Congestion Charge payments.",
        officialUrl: "https://tfl.gov.uk/modes/driving/check-your-vehicle/",
      });
    }

    const hasContinentalApproach = routeCountries.some((code) => code === "FR" || code === "BE" || code === "NL");
    if (hasContinentalApproach) {
      notices.push({
        countryCode,
        label: "Channel Crossing Booking",
        description: "Trips to Great Britain from continental Europe require a ferry or Eurotunnel booking.",
        officialUrl: "https://www.getlinkgroup.com/en/le-shuttle/",
      });
    }

    return notices;
  }

  if (countryCode === "IE") {
    return [
      {
        countryCode,
        label: "Ireland Toll",
        description: "Ireland has selected toll roads and eFlow-operated crossings.",
        officialUrl: SECTION_TOLL_LINKS.IE,
      },
    ];
  }

  if (countryCode === "TR") {
    return [
      {
        countryCode,
        label: "Turkey HGS/OGS Toll",
        description: "Turkey motorway and bridge crossings use HGS/OGS toll systems.",
        officialUrl: SECTION_TOLL_LINKS.TR,
      },
    ];
  }

  if (countryCode === "GR") {
    return [
      {
        countryCode,
        label: "Greece Motorway Toll",
        description: "Greek motorways commonly use toll plazas on long-distance corridors.",
        officialUrl: SECTION_TOLL_LINKS.GR,
      },
    ];
  }

  return [];
}
