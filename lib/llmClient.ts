import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import type { z } from "zod";

type Provider = "anthropic" | "openai";
type Effort = "low" | "medium" | "high" | "xhigh";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
// Claude Sonnet 5 uses adaptive thinking by default at a fairly deep effort
// level; "medium" is enough reasoning for structured resume parsing/tailoring
// without the extra latency/cost of "high"/"xhigh". Override via env if needed.
const ANTHROPIC_EFFORT = (process.env.ANTHROPIC_EFFORT || "medium") as Effort;

function resolveProvider(): Provider | null {
  const forced = process.env.LLM_PROVIDER?.toLowerCase();
  if (forced === "anthropic" || forced === "openai") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function isLlmConfigured(): boolean {
  return resolveProvider() !== null;
}

export function activeProviderLabel(): string {
  const provider = resolveProvider();
  if (provider === "anthropic") return `Anthropic (${ANTHROPIC_MODEL})`;
  if (provider === "openai") return `OpenAI (${OPENAI_MODEL})`;
  return "none";
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export interface ChatStructuredOptions {
  /** OpenAI only — Claude Sonnet 5 rejects `temperature` as deprecated. */
  temperature?: number;
  /** Anthropic adaptive-thinking effort override for this call. */
  effort?: Effort;
}

/**
 * Sends a system+user prompt to whichever provider is configured
 * (Anthropic's Claude Sonnet 5 preferred, OpenAI as a fallback) and returns a
 * response already validated against `schema`, using each provider's native
 * structured-output support (Anthropic's `output_config.format` /
 * `zodOutputFormat`, OpenAI's `response_format: json_object` + zod parse).
 */
export async function chatStructured<T>(
  system: string,
  user: string,
  schema: z.ZodType<T>,
  options: ChatStructuredOptions = {}
): Promise<T> {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error("No LLM provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY).");
  }

  if (provider === "anthropic") {
    const client = getAnthropicClient();
    // Do not pass `temperature` — Claude Sonnet 5 returns invalid_request_error
    // ("temperature is deprecated for this model"). Use effort instead for
    // regenerate-style variety.
    const message = await client.messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        effort: options.effort ?? ANTHROPIC_EFFORT,
        format: zodOutputFormat(schema),
      },
    });
    if (message.parsed_output == null) {
      const textBlock = message.content.find((block) => block.type === "text");
      throw new Error(
        `Claude did not return a parseable structured response${
          textBlock && "text" in textBlock ? `: ${textBlock.text.slice(0, 300)}` : "."
        }`
      );
    }
    return message.parsed_output;
  }

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: options.temperature ?? 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("The model returned an empty response.");
  return schema.parse(JSON.parse(content));
}
