import { z } from "zod";

/**
 * Valid vehicle class identifiers used across European vignette systems.
 * Each maps to a specific category recognized by toll operators.
 */
const VEHICLE_CLASSES = [
  "PASSENGER_CAR_M1",
  "COMMERCIAL_N1",
  "MOTORCYCLE",
  "VAN_OR_MPV",
  "UNKNOWN",
] as const;

/**
 * Powertrain types that affect vignette pricing and emission calculations.
 */
const POWERTRAIN_TYPES = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID"] as const;

/**
 * Emission classes used for vignette pricing in countries like Austria and Hungary.
 */
const EMISSION_CLASSES = [
  "ZERO_EMISSION",
  "EURO_6",
  "EURO_5_OR_LOWER",
  "UNKNOWN",
] as const;

/**
 * Channel crossing preferences for routes between UK and continental Europe.
 */
const CHANNEL_CROSSING_PREFERENCES = ["auto", "ferry", "tunnel"] as const;

/**
 * Schema for a geographic point with latitude and longitude.
 * Validates that coordinates are within valid geographic bounds.
 */
export const routePointSchema = z.object({
  lat: z
    .number()
    .finite("Latitude must be a finite number.")
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  lon: z
    .number()
    .finite("Longitude must be a finite number.")
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
});

/**
 * Full validation schema for route analysis requests.
 * Validates all fields including optional vehicle parameters.
 */
export const routeAnalysisRequestSchema = z.object({
  start: z
    .string()
    .trim()
    .min(1, "Start location is required.")
    .max(180, "Start location is too long (max 180 characters)."),
  end: z
    .string()
    .trim()
    .min(1, "Destination is required.")
    .max(180, "Destination is too long (max 180 characters)."),
  startPoint: routePointSchema.optional(),
  endPoint: routePointSchema.optional(),
  dateISO: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format.")
    .optional(),
  vehicleClass: z.enum(VEHICLE_CLASSES).optional(),
  powertrainType: z.enum(POWERTRAIN_TYPES).optional(),
  grossWeightKg: z
    .number()
    .positive("Gross weight must be a positive number.")
    .max(60_000, "Gross weight must be at most 60,000 kg.")
    .optional(),
  axles: z
    .number()
    .int("Axles must be a whole number.")
    .min(1, "Axles must be between 1 and 8.")
    .max(8, "Axles must be between 1 and 8.")
    .optional(),
  emissionClass: z.enum(EMISSION_CLASSES).optional(),
  seats: z.number().int().min(1).max(100).optional(),
  avoidTolls: z.boolean().optional(),
  channelCrossingPreference: z.enum(CHANNEL_CROSSING_PREFERENCES).optional(),
}).refine(
  (data) => data.start.toLowerCase() !== data.end.toLowerCase(),
  { message: "Start and destination must be different.", path: ["end"] },
);

/**
 * Validation schema for geocode suggestion query parameters.
 */
export const geocodeSuggestQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Query must be at least 2 characters.")
    .max(120, "Query is too long (max 120 characters)."),
});

/**
 * Type inferred from the route analysis request schema.
 * Use this instead of manually defining the request type.
 */
export type ValidatedRouteAnalysisRequest = z.infer<
  typeof routeAnalysisRequestSchema
>;

/**
 * Formats Zod validation errors into a single user-friendly string.
 * Joins all issue messages with semicolons for readability.
 */
export function formatZodErrors(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}
