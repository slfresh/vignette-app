import { z } from "zod";

/**
 * Runtime validation for environment variables.
 *
 * Called once at startup to fail fast if required variables are missing.
 * Optional variables (like Redis) degrade gracefully when absent.
 */
const envSchema = z.object({
  /** OpenRouteService API key – required for route calculation */
  ORS_API_KEY: z.string().min(1, "ORS_API_KEY is required for route calculations."),

  /** Upstash Redis URL – optional, falls back to in-memory rate limiting */
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),

  /** Upstash Redis token – optional, required if UPSTASH_REDIS_REST_URL is set */
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  /** Public URL used for metadata/SEO – optional, defaults to example.com */
  APP_PUBLIC_URL: z.string().url().optional(),

  /** Contact email for Nominatim User-Agent header – optional */
  APP_CONTACT_EMAIL: z.string().email().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns them typed.
 * Logs warnings for missing optional vars instead of crashing.
 */
export function validateEnv(): AppEnv {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    // Only throw if required vars are missing (ORS_API_KEY)
    const hasRequiredError = result.error.issues.some(
      (issue) => issue.path[0] === "ORS_API_KEY",
    );
    if (hasRequiredError) {
      throw new Error(
        `Missing required environment variables:\n${missing.join("\n")}\n\nSet these in your .env.local file.`,
      );
    }
    // Log warnings for optional vars
    console.warn(`[env] Optional environment variable warnings:\n${missing.join("\n")}`);
  }

  return result.success ? result.data : (process.env as unknown as AppEnv);
}
