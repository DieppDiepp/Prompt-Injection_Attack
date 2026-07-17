import { json } from "node:stream/consumers";
import { api } from "encore.dev/api";
import { appMeta } from "encore.dev";
import { airc } from "~encore/clients";
import type { AIRCMessage, AIRCWebhookEvent } from "../protocol";

const DEMO_ROOM_ID = "demo-lobby";
const mockAgents = [
  { agentId: "mock-agent-1", name: "Mock Agent 1" },
  { agentId: "mock-agent-2", name: "Mock Agent 2" },
  { agentId: "mock-agent-3", name: "Mock Agent 3" },
] as const;

const repliedDiscussions = new Set<string>();

export interface StartDemoRequest {
  content?: string;
}

export interface DemoDiscussion {
  discussionId: string;
  roomId: string;
  status: "active" | "stopped" | "quota_exhausted" | "expired";
  maxMessages: number;
  messageCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface StartDemoResponse {
  discussion: DemoDiscussion;
  message: AIRCMessage;
}

export const receiveWebhook = api.raw(
  { expose: true, method: "POST", path: "/v1/mock-agents/:agentId/webhook" },
  async (request, response) => {
    const payload: unknown = await json(request);
    if (!isWebhookEvent(payload)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "invalid AIRC webhook event" }));
      return;
    }

    const agentId = getAgentIdFromPath(request.url);
    if (!mockAgents.some((agent) => agent.agentId === agentId)) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "mock agent not found" }));
      return;
    }

    const replyKey = `${agentId}:${payload.message.discussionId}`;
    if (!repliedDiscussions.has(replyKey)) {
      repliedDiscussions.add(replyKey);
      await airc.sendMessage({
        discussionId: payload.message.discussionId,
        senderAgentId: agentId,
        content: `${displayName(agentId)} received message ${payload.message.sequence}`,
        metadata: {
          receivedMessageId: payload.message.messageId,
          mock: true,
        },
      });
    }

    response.writeHead(202, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ accepted: true }));
  },
);

export const setupDemo = api(
  { expose: true, method: "POST", path: "/v1/demo/setup" },
  async (): Promise<{ roomId: string; agentIds: string[] }> => {
    await ensureDemoRoom();
    return {
      roomId: DEMO_ROOM_ID,
      agentIds: mockAgents.map((agent) => agent.agentId),
    };
  },
);

export const startDemo = api(
  { expose: true, method: "POST", path: "/v1/demo/start" },
  async (
    request: StartDemoRequest,
  ): Promise<StartDemoResponse> => {
    await ensureDemoRoom();
    return airc.startDiscussion({
      roomId: DEMO_ROOM_ID,
      senderAgentId: "user",
      content: request.content ?? "Hello agents. Who received this message?",
      maxMessages: 30,
      timeoutSeconds: 300,
    });
  },
);

async function ensureDemoRoom(): Promise<void> {
  const baseUrl = appMeta().apiBaseUrl.replace(/\/$/, "");
  await airc.createRoom({ roomId: DEMO_ROOM_ID, name: "Demo Lobby" });

  for (const agent of mockAgents) {
    await airc.registerAgent({
      ...agent,
      framework: "mock",
      capabilities: ["acknowledge"],
      webhookUrl: `${baseUrl}/v1/mock-agents/${agent.agentId}/webhook`,
    });
    await airc.joinRoom({ roomId: DEMO_ROOM_ID, agentId: agent.agentId });
  }
}

function isWebhookEvent(value: unknown): value is AIRCWebhookEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<AIRCWebhookEvent>;
  return (
    candidate.event === "airc.message" &&
    typeof candidate.deliveryId === "string" &&
    typeof candidate.message === "object" &&
    candidate.message !== null &&
    typeof candidate.message.messageId === "string" &&
    typeof candidate.message.discussionId === "string"
  );
}

function getAgentIdFromPath(url: string | undefined): string {
  const pathname = new URL(url ?? "/", "http://localhost").pathname;
  const match = pathname.match(/^\/v1\/mock-agents\/([^/]+)\/webhook$/);
  return match ? decodeURIComponent(match[1]) : "";
}

function displayName(agentId: string): string {
  return mockAgents.find((agent) => agent.agentId === agentId)?.name ?? agentId;
}
