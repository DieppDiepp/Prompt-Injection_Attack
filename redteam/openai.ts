import { existsSync, readFileSync } from "node:fs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const REDTEAM_MODEL = "gpt-5.4-mini";
export const INJECTION_JUDGE_MODEL = "gpt-4o-mini";

export class OpenAIRequestError extends Error {}

interface OpenAIResponse {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
}

export async function askOpenAI(input: {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  model?: string;
}): Promise<string> {
  const model = input.model ?? REDTEAM_MODEL;
  const request: Record<string, unknown> = {
    model,
    instructions: input.instructions,
    input: input.input,
    max_output_tokens: input.maxOutputTokens,
  };
  // GPT-4o mini does not use the GPT-5 reasoning control. Keeping the payload
  // model-specific avoids turning a low-latency judgement into an API error.
  if (model !== INJECTION_JUDGE_MODEL) {
    request.reasoning = { effort: "low" };
  }
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) {
    throw new OpenAIRequestError(
      payload.error?.message
        ? `OpenAI API error: ${payload.error.message}`
        : `OpenAI API returned HTTP ${response.status}.`,
    );
  }

  const output = readOutputText(payload);
  if (!output) {
    throw new OpenAIRequestError("OpenAI API returned no output text.");
  }
  return output;
}

/**
 * A reference is deliberately server-only: it is never accepted from the UI
 * or persisted with a target. For a long prompt prefer a private UTF-8 file
 * path in INJECTION_JUDGE_REFERENCE_FILE rather than an inline environment
 * value.
 */
export function readInjectionJudgeReference(): string | undefined {
  loadLocalDotEnv();
  const inline = process.env.INJECTION_JUDGE_REFERENCE?.trim();
  if (inline) return inline;

  const path = process.env.INJECTION_JUDGE_REFERENCE_FILE?.trim();
  if (!path || !existsSync(path)) return undefined;
  const source = readFileSync(path, "utf8").trim();
  return source || undefined;
}

function readOpenAIKey(): string {
  const existing = process.env.OPENAI_API_KEY?.trim();
  if (existing) return existing;

  loadLocalDotEnv();
  const loaded = process.env.OPENAI_API_KEY?.trim();
  if (loaded) return loaded;

  throw new OpenAIRequestError(
    "OPENAI_API_KEY is not configured. Set it in the environment or the root .env file.",
  );
}

function loadLocalDotEnv(): void {
  if (!existsSync(".env")) return;
  const source = readFileSync(".env", "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

function readOutputText(payload: OpenAIResponse): string | undefined {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const chunks = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text?.trim() ?? "")
    .filter(Boolean);
  return chunks?.join("\n").trim() || undefined;
}
