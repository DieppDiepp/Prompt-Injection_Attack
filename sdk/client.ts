import type { AIRCMessage } from "../protocol";

export interface AIRCClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export interface RegisterAgentInput {
  agentId: string;
  name: string;
  webhookUrl: string;
  framework?: string;
  capabilities?: string[];
}

export interface CreateRoomInput {
  roomId?: string;
  name: string;
}

export interface StartDiscussionInput {
  senderAgentId?: string;
  content: string;
  maxMessages?: number;
  timeoutSeconds?: number;
}

export interface SendMessageInput {
  senderAgentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface DiscussionResponse {
  discussion: {
    discussionId: string;
    roomId: string;
    status: string;
    maxMessages: number;
    messageCount: number;
    expiresAt: string;
  };
  message: AIRCMessage;
}

export class AIRCClient {
  private readonly baseUrl: string;
  private readonly requestFetch: typeof globalThis.fetch;

  constructor(options: AIRCClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.requestFetch = options.fetch ?? globalThis.fetch;
  }

  registerAgent(input: RegisterAgentInput): Promise<unknown> {
    return this.request("/v1/agents", { method: "POST", body: input });
  }

  createRoom(input: CreateRoomInput): Promise<unknown> {
    return this.request("/v1/rooms", { method: "POST", body: input });
  }

  joinRoom(roomId: string, agentId: string): Promise<void> {
    return this.request(`/v1/rooms/${encodeURIComponent(roomId)}/agents`, {
      method: "POST",
      body: { agentId },
    });
  }

  startDiscussion(
    roomId: string,
    input: StartDiscussionInput,
  ): Promise<DiscussionResponse> {
    return this.request(
      `/v1/rooms/${encodeURIComponent(roomId)}/discussions`,
      { method: "POST", body: input },
    );
  }

  sendMessage(
    discussionId: string,
    input: SendMessageInput,
  ): Promise<AIRCMessage> {
    return this.request(
      `/v1/discussions/${encodeURIComponent(discussionId)}/messages`,
      { method: "POST", body: input },
    );
  }

  stopDiscussion(discussionId: string): Promise<void> {
    return this.request(
      `/v1/discussions/${encodeURIComponent(discussionId)}/stop`,
      { method: "POST" },
    );
  }

  private async request<T>(
    path: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    const response = await this.requestFetch(`${this.baseUrl}${path}`, {
      method: options.method,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`AIRC request failed (${response.status}): ${details}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}
