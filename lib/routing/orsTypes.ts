export interface OrsExtraRange {
  values: [number, number, number][];
}

export interface OrsFeature {
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties?: {
    extras?: {
      countryinfo?: OrsExtraRange;
      waycategory?: OrsExtraRange;
    };
    summary?: {
      distance?: number;
    };
  };
}

export interface OrsDirectionsResponse {
  type: "FeatureCollection";
  features: OrsFeature[];
}
