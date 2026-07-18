import type { AIRCWebhookReply } from "../protocol";

const MAX_REPLY_LENGTH = 20_000;

export function parseWebhookReply(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!isWebhookOutput(candidate)) {
    return undefined;
  }

  const output = candidate.output.trim();
  if (output.length === 0 || output.length > MAX_REPLY_LENGTH) {
    return undefined;
  }
  return output;
}

function isWebhookOutput(value: unknown): value is AIRCWebhookReply {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "output" in value && typeof value.output === "string";
}
