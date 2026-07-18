import { describe, expect, test } from "vitest";
import type { AIRCWebhookEvent } from "../protocol";
import { createWebhookRequestBody } from "./target";

describe("n8n webhook request body", () => {
  test("sends the AIRC event directly so n8n creates the only envelope", () => {
    const event: AIRCWebhookEvent = {
      event: "airc.message",
      deliveryId: "delivery-1",
      message: {
        protocolVersion: "0.1",
        messageId: "message-1",
        discussionId: "session-1",
        roomId: "red-team-lab",
        senderAgentId: "red-team-lead",
        sequence: 1,
        type: "message",
        content: "Xin chào",
        createdAt: "2026-07-18T00:00:00.000Z",
      },
    };

    expect(
      createWebhookRequestBody(event),
    ).toEqual(event);
  });
});
