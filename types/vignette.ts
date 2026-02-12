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

export interface RouteAnalysisResult {
  routeGeoJson: RouteLineString;
  countries: CountryTravelSummary[];
  sectionTolls: SectionTollNotice[];
  compliance: ComplianceNotice;
  appliedPreferences?: {
    avoidTolls: boolean;
    channelCrossingPreference: "auto" | "ferry" | "tunnel";
    vehicleClass: VehicleClass;
  };
}

export interface RouteAnalysisRequest {
  start: string;
  end: string;
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
  dateISO?: string;
  vehicleClass?: VehicleClass;
  seats?: number;
  avoidTolls?: boolean;
  channelCrossingPreference?: "auto" | "ferry" | "tunnel";
}
