import { describe, expect, test } from "vitest";
import type { AIRCWebhookEvent } from "../protocol";
import { createWebhookExecutionPayload } from "./target";

describe("n8n webhook execution envelope", () => {
  test("wraps the AIRC event in the participant's expected payload", () => {
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
      createWebhookExecutionPayload("https://target.example.com/webhook/test-agent", event),
    ).toEqual([
      {
        headers: {
          "content-type": "application/json",
          "user-agent": "AIRC-Red-Team-Lab/0.1",
        },
        params: {},
        query: {},
        body: event,
        webhookUrl: "https://target.example.com/webhook/test-agent",
        executionMode: "production",
      },
    ]);
  });
});
