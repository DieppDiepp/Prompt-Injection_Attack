import { describe, expect, test } from "vitest";
import {
  AIRC_PROTOCOL_VERSION,
  DEFAULT_DISCUSSION_LIMITS,
  type AIRCWebhookEvent,
} from "./index";

describe("AIRC protocol", () => {
  test("exposes stable MVP defaults", () => {
    expect(AIRC_PROTOCOL_VERSION).toBe("0.1");
    expect(DEFAULT_DISCUSSION_LIMITS).toEqual({
      maxMessages: 30,
      timeoutSeconds: 300,
    });
  });

  test("models the webhook delivery contract", () => {
    const event: AIRCWebhookEvent = {
      event: "airc.message",
      deliveryId: "delivery-1",
      message: {
        protocolVersion: AIRC_PROTOCOL_VERSION,
        messageId: "message-1",
        discussionId: "discussion-1",
        roomId: "room-1",
        senderAgentId: "agent-1",
        sequence: 1,
        type: "message",
        content: "Hello",
        createdAt: new Date(0).toISOString(),
      },
    };

    expect(event.event).toBe("airc.message");
    expect(event.message.sequence).toBe(1);
  });
});
