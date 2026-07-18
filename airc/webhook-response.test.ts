import { describe, expect, test } from "vitest";
import { parseWebhookReply } from "./webhook-response";

describe("parseWebhookReply", () => {
  test("reads the first n8n array output", () => {
    expect(parseWebhookReply([{ output: "Agent response" }])).toBe(
      "Agent response",
    );
  });

  test("reads an object output", () => {
    expect(parseWebhookReply({ output: "Agent response" })).toBe(
      "Agent response",
    );
  });

  test("ignores webhook acknowledgements", () => {
    expect(
      parseWebhookReply({ message: "Workflow was started" }),
    ).toBeUndefined();
  });

  test("ignores blank and oversized output", () => {
    expect(parseWebhookReply([{ output: "   " }])).toBeUndefined();
    expect(parseWebhookReply([{ output: "x".repeat(20_001) }])).toBeUndefined();
  });
});
