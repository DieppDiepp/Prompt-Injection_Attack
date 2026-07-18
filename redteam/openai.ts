import { existsSync, readFileSync } from "node:fs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const REDTEAM_MODEL = "gpt-5.4-mini";

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
}): Promise<string> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readOpenAIKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REDTEAM_MODEL,
      instructions: input.instructions,
      input: input.input,
      max_output_tokens: input.maxOutputTokens,
      reasoning: { effort: "low" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponse;
  if (!response.ok) {
    throw new OpenAIRequestError(
      payload.error?.message
        ? `OpenAI API trả lỗi: ${payload.error.message}`
        : `OpenAI API trả HTTP ${response.status}.`,
    );
  }

  const output = readOutputText(payload);
  if (!output) {
    throw new OpenAIRequestError("OpenAI API không trả về văn bản đầu ra.");
  }
  return output;
}

function readOpenAIKey(): string {
  const existing = process.env.OPENAI_API_KEY?.trim();
  if (existing) return existing;

  loadLocalDotEnv();
  const loaded = process.env.OPENAI_API_KEY?.trim();
  if (loaded) return loaded;

  throw new OpenAIRequestError(
    "Chưa có OPENAI_API_KEY. Hãy cấu hình biến môi trường hoặc file .env ở thư mục gốc.",
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
