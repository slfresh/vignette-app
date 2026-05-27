import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { BRIEFING_USER_PROMPT } from "@/lib/ai/briefingPrompt";
import { buildEnrichedRouteContext } from "@/lib/ai/contextBuilder";
import { fetchRouteWeather } from "@/lib/weather/openMeteo";
import { fetchTrafficAlongRoute } from "@/lib/traffic/tomtom";
import { fetchSpeedCamerasAlongRoute } from "@/lib/cameras/speedCameras";
import { logger } from "@/lib/logging/logger";
import {
  aiBriefingRequestSchema,
  formatZodErrors,
  MAX_AI_BODY_BYTES,
  parseJsonBody,
} from "@/lib/validation/schemas";
import type { RouteAnalysisResult } from "@/types/vignette";

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const AI_MODEL = process.env.AI_MODEL || "default";

/**
 * POST /api/ai/briefing
 *
 * Generates an AI-powered route briefing by:
 * 1. Fetching weather, traffic, and speed camera data in parallel
 * 2. Building an enriched context from all data sources
 * 3. Streaming an LLM-generated briefing back to the client
 *
 * Requires AI_ENABLED=true. Rate-limited to 10 requests/minute.
 */
export async function POST(request: Request) {
  if (process.env.AI_ENABLED !== "true") {
    return new Response(
      JSON.stringify({ error: "AI features are not enabled." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const rateLimit = await checkRateLimit(request, "ai-briefing", 10, 60_000);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait." }),
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    let body: unknown;
    try {
      body = await parseJsonBody(request, MAX_AI_BODY_BYTES);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "BODY_TOO_LARGE") {
        return new Response(JSON.stringify({ error: "Request body too large." }), {
          status: 413,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = aiBriefingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: formatZodErrors(parsed.error) }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { routeCoordinates, locale } = parsed.data;
    const routeResult = (body as { routeResult: RouteAnalysisResult }).routeResult;
    const LOCALE_NAMES: Record<string, string> = { en: "English", de: "German", tr: "Turkish", pl: "Polish", ro: "Romanian" };
    const langName = LOCALE_NAMES[locale ?? "en"] ?? "English";

    const timer = logger.time("ai-briefing-data-fetch");

    const [weather, traffic, cameras] = await Promise.all([
      fetchRouteWeather(routeCoordinates).catch((err) => {
        logger.warn("Briefing: weather fetch failed", { error: String(err) });
        return undefined;
      }),
      fetchTrafficAlongRoute(routeCoordinates).catch((err) => {
        logger.warn("Briefing: traffic fetch failed", { error: String(err) });
        return undefined;
      }),
      fetchSpeedCamerasAlongRoute(routeCoordinates).catch((err) => {
        logger.warn("Briefing: camera fetch failed", { error: String(err) });
        return undefined;
      }),
    ]);

    timer.end();

    const enrichedContext = buildEnrichedRouteContext({
      result: routeResult,
      weather: weather ?? undefined,
      traffic: traffic ?? undefined,
      cameras: cameras ?? undefined,
    });

    const systemMessage = `${SYSTEM_PROMPT}\n\nIMPORTANT: Respond entirely in ${langName}.\n\n${enrichedContext}`;

    const provider = createOpenAICompatible({
      name: "lm-studio",
      baseURL: LM_STUDIO_URL,
    });

    const streamTimer = logger.time("ai-briefing-stream");

    const result = streamText({
      model: provider(AI_MODEL),
      system: systemMessage,
      messages: [{ role: "user", content: BRIEFING_USER_PROMPT }],
      temperature: 0.6,
    });

    streamTimer.end();

    return result.toTextStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI briefing error", { error: message });

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return new Response(
        JSON.stringify({
          error: "AI assistant is not available. Make sure LM Studio is running.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "AI briefing generation failed. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
