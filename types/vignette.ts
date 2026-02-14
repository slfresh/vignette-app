export type CountryCode =
  | "DE"
  | "AT"
  | "CZ"
  | "SK"
  | "HU"
  | "SI"
  | "CH"
  | "RO"
  | "BG"
  | "HR"
  | "RS"
  | "DK"
  | "SE"
  | "NL"
  | "BE"
  | "FR"
  | "IT"
  | "BA"
  | "ME"
  | "XK"
  | "MK"
  | "AL"
  | "PL"
  | "ES"
  | "PT"
  | "GB"
  | "IE"
  | "TR"
  | "GR";

export type CurrencyCode = "EUR" | "CHF" | "CZK" | "HUF" | "BGN" | "RSD" | "DKK" | "SEK" | "GBP" | "TRY";

export type VehicleClass =
  | "PASSENGER_CAR_M1"
  | "COMMERCIAL_N1"
  | "MOTORCYCLE"
  | "VAN_OR_MPV"
  | "UNKNOWN";

export type EmissionClass = "ZERO_EMISSION" | "EURO_6" | "EURO_5_OR_LOWER" | "UNKNOWN";
export type PowertrainType = "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID";

export interface RoutePoint {
  lat: number;
  lon: number;
}

export interface RouteSegment {
  startIndex: number;
  endIndex: number;
  countryId: number;
  wayCategory: number;
}

export interface CountryTravelSummary {
  countryCode: CountryCode;
  highwayDistanceMeters: number;
  requiresVignette: boolean;
  requiresSectionToll: boolean;
  notices: string[];
  routeSegments?: RouteLineString[];
}

export interface SectionTollNotice {
  countryCode: CountryCode;
  label: string;
  description: string;
  officialUrl?: string;
}

export interface ComplianceNotice {
  official_source: true;
  informational_only: true;
  price_last_verified_at: string;
}

export interface VignetteProduct {
  id: string;
  label: string;
  price: number;
  currency: CurrencyCode;
  notes?: string;
  vehicleTags?: VehicleClass[];
  powertrainTags?: PowertrainType[];
}

export interface CountryPricing {
  countryCode: CountryCode;
  countryName: string;
  products: VignetteProduct[];
  caveats: string[];
}

export interface RouteLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface TripEstimate {
  totalDistanceKm: number;
  vignetteEstimateEur: number;
  sectionTollEstimateEur: number;
  totalRoadChargesEur: number;
  vignetteBreakdown: Array<{
    countryCode: CountryCode;
    productLabel: string;
    originalPrice: {
      amount: number;
      currency: CurrencyCode;
    };
    priceEur: number;
  }>;
  sectionTollBreakdown: Array<{
    countryCode: CountryCode;
    estimatedEur: number;
  }>;
  powertrain: "combustion" | "electric";
  fuel?: {
    assumedFuelType: "petrol" | "diesel";
    litersNeeded: number;
    averagePricePerLiterEur: number;
    estimatedFuelCostEur: number;
    bestTopUpCountryCode?: CountryCode;
    bestTopUpPriceEurPerLiter?: number;
    routeCountryFuelPrices: Array<{
      countryCode: CountryCode;
      priceEurPerLiter: number;
    }>;
    estimatedRangePerFullTankKm: number;
    suggestedTopUpCountries: CountryCode[];
    /** Human-readable fuel strategy that accounts for tank range vs cheapest country */
    fuelStrategy?: string;
  };
  electric?: {
    kwhNeeded: number;
    averagePricePerKwhEur: number;
    estimatedChargingCostEur: number;
    bestChargeCountryCode?: CountryCode;
    bestChargePriceEurPerKwh?: number;
    routeCountryChargingPrices: Array<{
      countryCode: CountryCode;
      priceEurPerKwh: number;
    }>;
    estimatedRangePerFullChargeKm: number;
    suggestedChargeCountries: CountryCode[];
  };
  assumptions: string[];
}

export interface TripShieldInsights {
  hasFreeFlowToll: boolean;
  hasMajorUrbanZoneRisk: boolean;
  hasBorderCrossing: boolean;
  departureTimeHint?: string;
  tollWindowImpact?: {
    countryCode: CountryCode;
    level: "savings_opportunity" | "surcharge_risk" | "neutral";
    title: string;
    details: string;
    estimatedDelta: string;
  };
  warnings: string[];
}

export interface TripTimelineEntry {
  countryCode: CountryCode;
  label: string;
  action: string;
  estimatedCostEur?: number;
  requiresVignette: boolean;
  requiresSectionToll: boolean;
  hasUrbanAccessRisk: boolean;
}

export interface TripReadiness {
  confidenceScore: number;
  confidenceLevel: "high" | "medium" | "low";
  confidenceReasons: string[];
  timeline: TripTimelineEntry[];
  checklist: string[];
}

export interface RouteAnalysisResult {
  routeGeoJson: RouteLineString;
  countries: CountryTravelSummary[];
  sectionTolls: SectionTollNotice[];
  compliance: ComplianceNotice;
  tripEstimate?: TripEstimate;
  tripShield?: TripShieldInsights;
  tripReadiness?: TripReadiness;
  borderCrossings?: Array<{
    countryCodeFrom: CountryCode;
    countryCodeTo: CountryCode;
    lat: number;
    lon: number;
  }>;
  appliedPreferences?: {
    avoidTolls: boolean;
    channelCrossingPreference: "auto" | "ferry" | "tunnel";
    vehicleClass: VehicleClass;
    powertrainType?: PowertrainType;
    grossWeightKg?: number;
    axles?: number;
    emissionClass?: EmissionClass;
  };
}

export interface RouteAnalysisRequest {
  start: string;
  end: string;
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
  dateISO?: string;
  vehicleClass?: VehicleClass;
  powertrainType?: PowertrainType;
  grossWeightKg?: number;
  axles?: number;
  emissionClass?: EmissionClass;
  seats?: number;
  avoidTolls?: boolean;
  channelCrossingPreference?: "auto" | "ferry" | "tunnel";
}
