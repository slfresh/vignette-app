import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { SYSTEM_PROMPT } from "@/lib/ai/systemPrompt";
import { logger } from "@/lib/logging/logger";

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || "http://localhost:1234/v1";
const AI_MODEL = process.env.AI_MODEL || "default";

/**
 * POST /api/ai/chat
 *
 * Streaming chat endpoint powered by LM Studio (local LLM).
 * Uses the Vercel AI SDK for streaming responses to the client.
 *
 * When LM_STUDIO_URL is not set or LM Studio is not running,
 * returns a graceful error — the app works without AI.
 */
export async function POST(request: Request) {
  // Gate: AI must be explicitly enabled
  if (process.env.AI_ENABLED !== "true") {
    return new Response(
      JSON.stringify({ error: "AI features are not enabled." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const rateLimit = await checkRateLimit(request, "ai-chat", 20, 60_000);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait." }),
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const messages = body.messages;
    const routeContext = body.routeContext ?? "";

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Build system prompt with optional route context
    let systemMessage = SYSTEM_PROMPT;
    if (routeContext) {
      systemMessage += `\n\n${routeContext}`;
    }

    const provider = createOpenAICompatible({
      name: "lm-studio",
      baseURL: LM_STUDIO_URL,
    });

    const timer = logger.time("ai-chat-stream");

    const result = streamText({
      model: provider(AI_MODEL),
      system: systemMessage,
      messages,
      temperature: 0.7,
    });

    timer.end();

    return result.toTextStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("AI chat error", { error: message });

    // Connection refused = LM Studio not running
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return new Response(
        JSON.stringify({
          error: "AI assistant is not available. Make sure LM Studio is running.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "AI request failed. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
