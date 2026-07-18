export const AIRC_PROTOCOL_VERSION = "0.1" as const;

export type AIRCMessageType = "message" | "system";

export interface AIRCMessage {
  protocolVersion: typeof AIRC_PROTOCOL_VERSION;
  messageId: string;
  discussionId: string;
  roomId: string;
  senderAgentId: string;
  sequence: number;
  type: AIRCMessageType;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface AIRCWebhookEvent {
  event: "airc.message";
  deliveryId: string;
  message: AIRCMessage;
}

export interface AIRCWebhookAcknowledgement {
  accepted: boolean;
}

export interface AIRCWebhookReply {
  output: string;
}

export type AIRCWebhookResponse =
  | AIRCWebhookAcknowledgement
  | AIRCWebhookReply
  | AIRCWebhookReply[];

export interface AIRCDiscussionLimits {
  maxMessages: number;
  timeoutSeconds: number;
}

export const DEFAULT_DISCUSSION_LIMITS: AIRCDiscussionLimits = {
  maxMessages: 30,
  timeoutSeconds: 300,
};
