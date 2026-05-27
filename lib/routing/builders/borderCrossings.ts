import type { AnalysisDraft } from "@/lib/routing/analyzeRouteRequirements";
import type { CountryCode, RouteAnalysisResult } from "@/types/vignette";

export function extractBorderCrossings(draft: AnalysisDraft): RouteAnalysisResult["borderCrossings"] {
  const segments: Array<{ countryCode: CountryCode; start: number; end: number }> = [];

  for (const [code, data] of draft.countries.entries()) {
    for (const range of data.segmentRanges) {
      segments.push({ countryCode: code, start: range.start, end: range.end });
    }
  }

  segments.sort((a, b) => a.start - b.start);

  const crossings: NonNullable<RouteAnalysisResult["borderCrossings"]> = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    if (current.countryCode !== next.countryCode) {
      const pointIndex = current.end;
      const coord = draft.lineString.coordinates[pointIndex];

      if (coord) {
        crossings.push({
          countryCodeFrom: current.countryCode,
          countryCodeTo: next.countryCode,
          lon: coord[0],
          lat: coord[1],
        });
      }
    }
  }

  return crossings;
}
