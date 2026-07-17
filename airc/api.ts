import { randomUUID } from "node:crypto";
import { APIError, api } from "encore.dev/api";
import type { Query } from "encore.dev/api";
import {
  AIRC_PROTOCOL_VERSION,
  DEFAULT_DISCUSSION_LIMITS,
  type AIRCMessage,
  type AIRCMessageType,
} from "../protocol";
import { AIRCDB } from "./db";
import { MessagePublishedTopic } from "./topic";

export interface Agent {
  agentId: string;
  name: string;
  webhookUrl: string;
  framework?: string;
  capabilities: string[];
  active: boolean;
}

export interface RegisterAgentRequest {
  agentId: string;
  name: string;
  webhookUrl: string;
  framework?: string;
  capabilities?: string[];
}

export interface Room {
  roomId: string;
  name: string;
}

export interface CreateRoomRequest {
  roomId?: string;
  name: string;
}

export interface JoinRoomRequest {
  agentId: string;
}

export type DiscussionStatus =
  | "active"
  | "stopped"
  | "quota_exhausted"
  | "expired";

export interface Discussion {
  discussionId: string;
  roomId: string;
  status: DiscussionStatus;
  maxMessages: number;
  messageCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface StartDiscussionRequest {
  senderAgentId?: string;
  content: string;
  maxMessages?: number;
  timeoutSeconds?: number;
}

export interface SendMessageRequest {
  senderAgentId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface ListAgentsResponse {
  agents: Agent[];
}

interface ListRoomsResponse {
  rooms: Room[];
}

interface ListRoomAgentsResponse {
  agents: Agent[];
}

interface StartDiscussionResponse {
  discussion: Discussion;
  message: AIRCMessage;
}

interface ListMessagesRequest {
  discussionId: string;
  limit?: Query<number>;
}

interface ListMessagesResponse {
  discussion: Discussion;
  messages: AIRCMessage[];
}

interface LatestRoomMessagesRequest {
  roomId: string;
  limit?: Query<number>;
}

interface AgentRow {
  agent_id: string;
  name: string;
  webhook_url: string;
  framework: string | null;
  capabilities: unknown;
  active: boolean;
}

interface RoomRow {
  room_id: string;
  name: string;
}

interface DiscussionRow {
  discussion_id: string;
  room_id: string;
  status: DiscussionStatus;
  max_messages: number;
  message_count: number;
  expires_at: Date;
  created_at: Date;
}

interface MessageRow {
  message_id: string;
  discussion_id: string;
  room_id: string;
  sender_agent_id: string;
  sequence: number;
  type: AIRCMessageType;
  content: string;
  metadata: unknown;
  created_at: Date;
}

export const registerAgent = api(
  { expose: true, method: "POST", path: "/v1/agents" },
  async (request: RegisterAgentRequest): Promise<Agent> => {
    assertIdentifier(request.agentId, "agentId");
    assertNonEmpty(request.name, "name");
    assertWebhookUrl(request.webhookUrl);
    const capabilities = request.capabilities ?? [];

    const row = await AIRCDB.queryRow<AgentRow>`
      INSERT INTO agents (
        agent_id, name, webhook_url, framework, capabilities, active, updated_at
      )
      VALUES (
        ${request.agentId}, ${request.name}, ${request.webhookUrl},
        ${request.framework ?? null}, ${JSON.stringify(capabilities)}::jsonb,
        TRUE, NOW()
      )
      ON CONFLICT (agent_id) DO UPDATE SET
        name = EXCLUDED.name,
        webhook_url = EXCLUDED.webhook_url,
        framework = EXCLUDED.framework,
        capabilities = EXCLUDED.capabilities,
        active = TRUE,
        updated_at = NOW()
      RETURNING agent_id, name, webhook_url, framework, capabilities, active
    `;

    if (!row) {
      throw APIError.internal("agent registration did not return a row");
    }
    return mapAgent(row);
  },
);

export const listAgents = api(
  { expose: true, method: "GET", path: "/v1/agents" },
  async (): Promise<ListAgentsResponse> => {
    const rows = AIRCDB.query<AgentRow>`
      SELECT agent_id, name, webhook_url, framework, capabilities, active
      FROM agents
      ORDER BY created_at ASC
    `;
    const agents: Agent[] = [];
    for await (const row of rows) {
      agents.push(mapAgent(row));
    }
    return { agents };
  },
);

export const createRoom = api(
  { expose: true, method: "POST", path: "/v1/rooms" },
  async (request: CreateRoomRequest): Promise<Room> => {
    const roomId = request.roomId ?? randomUUID();
    assertIdentifier(roomId, "roomId");
    assertNonEmpty(request.name, "name");

    const row = await AIRCDB.queryRow<RoomRow>`
      INSERT INTO rooms (room_id, name)
      VALUES (${roomId}, ${request.name})
      ON CONFLICT (room_id) DO UPDATE SET name = EXCLUDED.name
      RETURNING room_id, name
    `;
    if (!row) {
      throw APIError.internal("room creation did not return a row");
    }
    return mapRoom(row);
  },
);

export const listRooms = api(
  { expose: true, method: "GET", path: "/v1/rooms" },
  async (): Promise<ListRoomsResponse> => {
    const rows = AIRCDB.query<RoomRow>`
      SELECT room_id, name FROM rooms ORDER BY created_at ASC
    `;
    const rooms: Room[] = [];
    for await (const row of rows) {
      rooms.push(mapRoom(row));
    }
    return { rooms };
  },
);

export const joinRoom = api(
  { expose: true, method: "POST", path: "/v1/rooms/:roomId/agents" },
  async ({ roomId, agentId }: JoinRoomRequest & { roomId: string }): Promise<void> => {
    const result = await AIRCDB.queryRow<{ joined: boolean }>`
      INSERT INTO room_agents (room_id, agent_id)
      SELECT ${roomId}, ${agentId}
      WHERE EXISTS (SELECT 1 FROM rooms WHERE room_id = ${roomId})
        AND EXISTS (SELECT 1 FROM agents WHERE agent_id = ${agentId} AND active)
      ON CONFLICT (room_id, agent_id) DO UPDATE SET joined_at = room_agents.joined_at
      RETURNING TRUE AS joined
    `;
    if (!result) {
      throw APIError.notFound("room or active agent not found");
    }
  },
);

export const listRoomAgents = api(
  { expose: true, method: "GET", path: "/v1/rooms/:roomId/agents" },
  async ({ roomId }: { roomId: string }): Promise<ListRoomAgentsResponse> => {
    const room = await AIRCDB.queryRow<{ room_id: string }>`
      SELECT room_id FROM rooms WHERE room_id = ${roomId}
    `;
    if (!room) {
      throw APIError.notFound("room not found");
    }

    const rows = AIRCDB.query<AgentRow>`
      SELECT a.agent_id, a.name, a.webhook_url, a.framework,
             a.capabilities, a.active
      FROM room_agents ra
      JOIN agents a ON a.agent_id = ra.agent_id
      WHERE ra.room_id = ${roomId}
      ORDER BY ra.joined_at ASC
    `;
    const agents: Agent[] = [];
    for await (const row of rows) {
      agents.push(mapAgent(row));
    }
    return { agents };
  },
);

export const startDiscussion = api(
  { expose: true, method: "POST", path: "/v1/rooms/:roomId/discussions" },
  async (
    request: StartDiscussionRequest & { roomId: string },
  ): Promise<StartDiscussionResponse> => {
    const maxMessages = request.maxMessages ?? DEFAULT_DISCUSSION_LIMITS.maxMessages;
    const timeoutSeconds =
      request.timeoutSeconds ?? DEFAULT_DISCUSSION_LIMITS.timeoutSeconds;
    assertDiscussionLimits(maxMessages, timeoutSeconds);
    assertContent(request.content);

    const room = await AIRCDB.queryRow<{ room_id: string }>`
      SELECT room_id FROM rooms WHERE room_id = ${request.roomId}
    `;
    if (!room) {
      throw APIError.notFound("room not found");
    }

    const discussionId = randomUUID();
    const messageId = randomUUID();
    const senderAgentId = request.senderAgentId ?? "user";
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);
    const terminalStatus: DiscussionStatus =
      maxMessages === 1 ? "quota_exhausted" : "active";

    const discussionRow = await AIRCDB.queryRow<DiscussionRow>`
      INSERT INTO discussions (
        discussion_id, room_id, status, max_messages, message_count, expires_at,
        stopped_at
      )
      VALUES (
        ${discussionId}, ${request.roomId}, ${terminalStatus}, ${maxMessages}, 1,
        ${expiresAt}, ${terminalStatus === "active" ? null : new Date()}
      )
      RETURNING discussion_id, room_id, status, max_messages, message_count,
                expires_at, created_at
    `;
    if (!discussionRow) {
      throw APIError.internal("discussion creation did not return a row");
    }

    const message = await insertMessage({
      messageId,
      discussionId,
      roomId: request.roomId,
      senderAgentId,
      sequence: 1,
      content: request.content,
      metadata: undefined,
    });
    await MessagePublishedTopic.publish({ message });

    return { discussion: mapDiscussion(discussionRow), message };
  },
);

export const sendMessage = api(
  { expose: true, method: "POST", path: "/v1/discussions/:discussionId/messages" },
  async (
    request: SendMessageRequest & { discussionId: string },
  ): Promise<AIRCMessage> => {
    assertIdentifier(request.senderAgentId, "senderAgentId");
    assertContent(request.content);

    const discussion = await AIRCDB.queryRow<
      Pick<DiscussionRow, "room_id" | "message_count" | "max_messages" | "status">
    >`
      UPDATE discussions AS d
      SET
        message_count = d.message_count + 1,
        status = CASE
          WHEN d.message_count + 1 >= d.max_messages
            THEN 'quota_exhausted'::discussion_status
          ELSE 'active'::discussion_status
        END,
        stopped_at = CASE
          WHEN d.message_count + 1 >= d.max_messages THEN NOW()
          ELSE d.stopped_at
        END
      WHERE d.discussion_id = ${request.discussionId}
        AND d.status = 'active'
        AND d.expires_at > NOW()
        AND d.message_count < d.max_messages
        AND EXISTS (
          SELECT 1 FROM room_agents ra
          WHERE ra.room_id = d.room_id
            AND ra.agent_id = ${request.senderAgentId}
        )
      RETURNING d.room_id, d.message_count, d.max_messages, d.status
    `;

    if (!discussion) {
      await markExpired(request.discussionId);
      throw APIError.failedPrecondition(
        "discussion is stopped, expired, quota exhausted, or sender is not in the room",
      );
    }

    const message = await insertMessage({
      messageId: randomUUID(),
      discussionId: request.discussionId,
      roomId: discussion.room_id,
      senderAgentId: request.senderAgentId,
      sequence: discussion.message_count,
      content: request.content,
      metadata: request.metadata,
    });
    await MessagePublishedTopic.publish({ message });
    return message;
  },
);

export const stopDiscussion = api(
  { expose: true, method: "POST", path: "/v1/discussions/:discussionId/stop" },
  async ({ discussionId }: { discussionId: string }): Promise<void> => {
    const row = await AIRCDB.queryRow<{ discussion_id: string }>`
      UPDATE discussions
      SET status = 'stopped', stopped_at = NOW()
      WHERE discussion_id = ${discussionId} AND status = 'active'
      RETURNING discussion_id
    `;
    if (!row) {
      throw APIError.failedPrecondition("discussion is not active");
    }
  },
);

export const listMessages = api(
  { expose: true, method: "GET", path: "/v1/discussions/:discussionId/messages" },
  async (request: ListMessagesRequest): Promise<ListMessagesResponse> => {
    await markExpired(request.discussionId);
    const discussionRow = await getDiscussionRow(request.discussionId);
    if (!discussionRow) {
      throw APIError.notFound("discussion not found");
    }

    const limit = Math.min(Math.max(request.limit ?? 100, 1), 500);
    const rows = AIRCDB.query<MessageRow>`
      SELECT message_id, discussion_id, room_id, sender_agent_id, sequence,
             type, content, metadata, created_at
      FROM messages
      WHERE discussion_id = ${request.discussionId}
      ORDER BY sequence ASC
      LIMIT ${limit}
    `;
    const messages: AIRCMessage[] = [];
    for await (const row of rows) {
      messages.push(mapMessage(row));
    }
    return { discussion: mapDiscussion(discussionRow), messages };
  },
);

export const getLatestRoomMessages = api(
  {
    expose: true,
    method: "GET",
    path: "/v1/rooms/:roomId/discussions/latest",
  },
  async (request: LatestRoomMessagesRequest): Promise<ListMessagesResponse> => {
    const latest = await AIRCDB.queryRow<{ discussion_id: string }>`
      SELECT discussion_id
      FROM discussions
      WHERE room_id = ${request.roomId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!latest) {
      throw APIError.notFound("room has no discussions");
    }
    return readDiscussionMessages(latest.discussion_id, request.limit);
  },
);

async function readDiscussionMessages(
  discussionId: string,
  requestedLimit?: number,
): Promise<ListMessagesResponse> {
  await markExpired(discussionId);
  const discussionRow = await getDiscussionRow(discussionId);
  if (!discussionRow) {
    throw APIError.notFound("discussion not found");
  }

  const limit = Math.min(Math.max(requestedLimit ?? 100, 1), 500);
  const rows = AIRCDB.query<MessageRow>`
    SELECT message_id, discussion_id, room_id, sender_agent_id, sequence,
           type, content, metadata, created_at
    FROM messages
    WHERE discussion_id = ${discussionId}
    ORDER BY sequence ASC
    LIMIT ${limit}
  `;
  const messages: AIRCMessage[] = [];
  for await (const row of rows) {
    messages.push(mapMessage(row));
  }
  return { discussion: mapDiscussion(discussionRow), messages };
}

async function insertMessage(input: {
  messageId: string;
  discussionId: string;
  roomId: string;
  senderAgentId: string;
  sequence: number;
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<AIRCMessage> {
  const row = await AIRCDB.queryRow<MessageRow>`
    INSERT INTO messages (
      message_id, discussion_id, room_id, sender_agent_id, sequence,
      type, content, metadata
    )
    VALUES (
      ${input.messageId}, ${input.discussionId}, ${input.roomId},
      ${input.senderAgentId}, ${input.sequence}, 'message', ${input.content},
      ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb
    )
    RETURNING message_id, discussion_id, room_id, sender_agent_id, sequence,
              type, content, metadata, created_at
  `;
  if (!row) {
    throw APIError.internal("message insert did not return a row");
  }
  return mapMessage(row);
}

async function getDiscussionRow(
  discussionId: string,
): Promise<DiscussionRow | null> {
  return AIRCDB.queryRow<DiscussionRow>`
    SELECT discussion_id, room_id, status, max_messages, message_count,
           expires_at, created_at
    FROM discussions
    WHERE discussion_id = ${discussionId}
  `;
}

async function markExpired(discussionId: string): Promise<void> {
  await AIRCDB.exec`
    UPDATE discussions
    SET status = 'expired', stopped_at = NOW()
    WHERE discussion_id = ${discussionId}
      AND status = 'active'
      AND expires_at <= NOW()
  `;
}

function mapAgent(row: AgentRow): Agent {
  return {
    agentId: row.agent_id,
    name: row.name,
    webhookUrl: row.webhook_url,
    framework: row.framework ?? undefined,
    capabilities: parseStringArray(row.capabilities),
    active: row.active,
  };
}

function mapRoom(row: RoomRow): Room {
  return { roomId: row.room_id, name: row.name };
}

function mapDiscussion(row: DiscussionRow): Discussion {
  return {
    discussionId: row.discussion_id,
    roomId: row.room_id,
    status: row.status,
    maxMessages: row.max_messages,
    messageCount: row.message_count,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function mapMessage(row: MessageRow): AIRCMessage {
  return {
    protocolVersion: AIRC_PROTOCOL_VERSION,
    messageId: row.message_id,
    discussionId: row.discussion_id,
    roomId: row.room_id,
    senderAgentId: row.sender_agent_id,
    sequence: row.sequence,
    type: row.type,
    content: row.content,
    createdAt: row.created_at.toISOString(),
    metadata: parseRecord(row.metadata),
  };
}

function parseStringArray(value: unknown): string[] {
  const parsed = parseJSONValue(value);
  return Array.isArray(parsed)
    ? parsed.filter((item): item is string => typeof item === "string")
    : [];
}

function parseRecord(value: unknown): Record<string, unknown> | undefined {
  const parsed = parseJSONValue(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  return parsed as Record<string, unknown>;
}

function parseJSONValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function assertIdentifier(value: string, field: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value)) {
    throw APIError.invalidArgument(
      `${field} must be 1-64 characters using letters, numbers, underscores, or hyphens`,
    );
  }
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 200) {
    throw APIError.invalidArgument(`${field} must be between 1 and 200 characters`);
  }
}

function assertContent(content: string): void {
  if (content.trim().length === 0 || content.length > 20_000) {
    throw APIError.invalidArgument("content must be between 1 and 20000 characters");
  }
}

function assertWebhookUrl(webhookUrl: string): void {
  let url: URL;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw APIError.invalidArgument("webhookUrl must be a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw APIError.invalidArgument("webhookUrl must use http or https");
  }
}

function assertDiscussionLimits(maxMessages: number, timeoutSeconds: number): void {
  if (!Number.isInteger(maxMessages) || maxMessages < 1 || maxMessages > 1000) {
    throw APIError.invalidArgument("maxMessages must be an integer from 1 to 1000");
  }
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > 86_400
  ) {
    throw APIError.invalidArgument(
      "timeoutSeconds must be an integer from 1 to 86400",
    );
  }
}
