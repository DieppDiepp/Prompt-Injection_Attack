import { randomUUID } from "node:crypto";
import type { AIRCWebhookEvent } from "../protocol";
import { askOpenAI } from "./openai";

export type TargetMode = "webhook" | "local";

export interface StoredTarget {
  targetId: string;
  name: string;
  mode: TargetMode;
  webhookUrl: string | null;
  systemPrompt: string | null;
  protectedContent: string | null;
}

export interface ConversationEntry {
  role: "attacker" | "target";
  content: string;
}

export class TargetRequestError extends Error {}

export async function invokeTarget(input: {
  target: StoredTarget;
  sessionId: string;
  sequence: number;
  prompt: string;
  history: ConversationEntry[];
}): Promise<{ response: string; latencyMs: number }> {
  const startedAt = Date.now();
  const response = input.target.mode === "local"
    ? await invokeLocalTarget(input)
    : await invokeWebhookTarget(input);
  return { response, latencyMs: Date.now() - startedAt };
}

async function invokeLocalTarget(input: {
  target: StoredTarget;
  prompt: string;
  history: ConversationEntry[];
}): Promise<string> {
  if (!input.target.systemPrompt) {
    throw new TargetRequestError("The local target has no system prompt.");
  }
  return askOpenAI({
    instructions: input.target.systemPrompt,
    input: formatTargetInput(input.history, input.prompt),
    maxOutputTokens: 1_200,
  });
}

async function invokeWebhookTarget(input: {
  target: StoredTarget;
  sessionId: string;
  sequence: number;
  prompt: string;
}): Promise<string> {
  if (!input.target.webhookUrl) {
    throw new TargetRequestError("The webhook target has no URL.");
  }

  const event: AIRCWebhookEvent = {
    event: "airc.message",
    deliveryId: randomUUID(),
    message: {
      protocolVersion: "0.1",
      messageId: randomUUID(),
      discussionId: input.sessionId,
      roomId: "red-team-lab",
      senderAgentId: "red-team-lead",
      sequence: input.sequence,
      type: "message",
      content: input.prompt,
      createdAt: new Date().toISOString(),
    },
  };

  const payload = createWebhookRequestBody(event);

  let response: Response;
  try {
    response = await fetch(input.target.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw new TargetRequestError(`Unable to call the target webhook: ${messageOf(error)}`);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new TargetRequestError(`Target webhook returned HTTP ${response.status}.`);
  }
  const output = parseWebhookOutput(body);
  if (!output) {
    throw new TargetRequestError(
      "Target webhook must return JSON { output: string } or [{ output: string }].",
    );
  }
  return output;
}

export function createWebhookRequestBody(event: AIRCWebhookEvent): AIRCWebhookEvent {
  // n8n already creates its execution envelope around each incoming HTTP
  // request. Sending another envelope here made body become [[...]] instead of
  // the AIRC event the partner workflow expects.
  return event;
}

function formatTargetInput(history: ConversationEntry[], prompt: string): string {
  const transcript = history
    .slice(-24)
    .map((entry) => `${entry.role === "attacker" ? "User" : "Assistant"}: ${entry.content}`)
    .join("\n");
  return [
    "You are continuing a conversation. Answer the latest question according to your system prompt.",
    transcript ? `Conversation history:\n${transcript}` : "No prior conversation history.",
    `Latest user question:\n${prompt}`,
  ].join("\n\n");
}

function parseWebhookOutput(body: string): string | undefined {
  if (!body.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(body);
    const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "output" in candidate &&
      typeof candidate.output === "string" &&
      candidate.output.trim()
    ) {
      return candidate.output.trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
