import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { EXTRACT_SYSTEM_PROMPT, FILE_USER_MESSAGE, buildUserMessage } from "./prompt";
import { LlmBillSchema, type ExtractRequest, type LlmBill } from "./schema";

export const EXTRACT_MODEL = "claude-opus-5-5";

/** Error with a user-facing message and HTTP status. */
export class ExtractError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ExtractError";
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment. Never hardcode the key.
  client ??= new Anthropic({ timeout: 110_000, maxRetries: 0 });
  return client;
}

export function isConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Call Claude with structured outputs; returns the loosely-validated model output. */
export async function extractWithClaude(input: ExtractRequest): Promise<LlmBill> {
  const content: Anthropic.Beta.BetaContentBlockParam[] | string =
    "text" in input
      ? buildUserMessage(input.text)
      : [
          ...input.files.map((f): Anthropic.Beta.BetaContentBlockParam =>
            f.mediaType === "application/pdf"
              ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.data } }
              : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.data } },
          ),
          { type: "text", text: FILE_USER_MESSAGE },
        ];
  let msg;
  try {
    msg = await getClient().beta.messages.parse({
      model: EXTRACT_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { format: betaZodOutputFormat(LlmBillSchema), effort: "low" },
    });
  } catch (err) {
    throw mapSdkError(err);
  }

  if (msg.stop_reason === "refusal") {
    throw new ExtractError("The AI could not process this text. Please enter the bill lines manually.", 422);
  }
  if (msg.stop_reason === "max_tokens") {
    throw new ExtractError("This bill is too long to extract automatically. Try pasting fewer lines at a time.", 422);
  }
  if (!msg.parsed_output) {
    throw new ExtractError("The AI returned an unreadable result. Please try again or enter lines manually.", 502);
  }
  return msg.parsed_output;
}

function mapSdkError(err: unknown): ExtractError {
  if (err instanceof Anthropic.RateLimitError) {
    return new ExtractError("The extraction service is busy. Please try again in a minute.", 429);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[extract] Anthropic auth error", err.status);
    return new ExtractError("Extraction service is not configured", 503);
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ExtractError("The extraction took too long. Please try again or paste fewer lines.", 504);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ExtractError("Could not reach the extraction service. Please try again.", 502);
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[extract] Anthropic bad request", err.status, err.message);
    return new ExtractError("The extraction request was rejected. Please try again or enter lines manually.", 502);
  }
  if (err instanceof Anthropic.APIError) {
    console.error("[extract] Anthropic API error", err.status);
    return new ExtractError("The extraction service failed. Please try again.", 502);
  }
  // Includes SDK-side parse/validation failures of the structured output.
  console.error("[extract] unexpected error", err instanceof Error ? err.name : typeof err);
  return new ExtractError("The AI returned an unreadable result. Please try again or enter lines manually.", 502);
}
