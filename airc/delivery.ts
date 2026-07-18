import { randomUUID } from "node:crypto";
import log from "encore.dev/log";
import { Subscription } from "encore.dev/pubsub";
import type { AIRCWebhookEvent } from "../protocol";
import { sendMessage } from "./api";
import { AIRCDB } from "./db";
import { MessagePublishedTopic, type MessagePublishedEvent } from "./topic";
import { parseWebhookReply } from "./webhook-response";

interface RecipientRow {
  agent_id: string;
  webhook_url: string;
}

const _ = new Subscription(MessagePublishedTopic, "deliver-room-webhooks", {
  handler: deliverMessage,
});

async function deliverMessage(event: MessagePublishedEvent): Promise<void> {
  const recipients = AIRCDB.query<RecipientRow>`
    SELECT a.agent_id, a.webhook_url
    FROM room_agents ra
    JOIN agents a ON a.agent_id = ra.agent_id
    WHERE ra.room_id = ${event.message.roomId}
      AND a.active = TRUE
      AND a.agent_id <> ${event.message.senderAgentId}
    ORDER BY ra.joined_at ASC
  `;

  const deliveries: Promise<void>[] = [];
  for await (const recipient of recipients) {
    deliveries.push(deliverToRecipient(event, recipient));
  }

  const results = await Promise.allSettled(deliveries);
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `${failures.length} AIRC webhook deliveries failed`,
    );
  }
}

async function deliverToRecipient(
  event: MessagePublishedEvent,
  recipient: RecipientRow,
): Promise<void> {
  const deliveryId = randomUUID();
  const claim = await AIRCDB.queryRow<{ delivery_id: string }>`
    INSERT INTO webhook_deliveries (
      delivery_id, message_id, agent_id, status, attempts, updated_at
    )
    VALUES (${deliveryId}, ${event.message.messageId}, ${recipient.agent_id}, 'pending', 1, NOW())
    ON CONFLICT (message_id, agent_id) DO UPDATE SET
      attempts = webhook_deliveries.attempts + 1,
      status = 'pending',
      updated_at = NOW()
    WHERE webhook_deliveries.status <> 'delivered'
    RETURNING delivery_id
  `;
  if (!claim) {
    return;
  }

  const payload: AIRCWebhookEvent = {
    event: "airc.message",
    deliveryId: claim.delivery_id,
    message: event.message,
  };

  try {
    const response = await fetch(recipient.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`webhook returned HTTP ${response.status}`);
    }

    const reply = parseWebhookReply(await readJSONResponse(response));

    await AIRCDB.exec`
      UPDATE webhook_deliveries
      SET status = 'delivered', response_status = ${response.status},
          last_error = NULL, delivered_at = NOW(), updated_at = NOW()
      WHERE delivery_id = ${claim.delivery_id}
    `;
    log.info("delivered AIRC room message", {
      messageId: event.message.messageId,
      agentId: recipient.agent_id,
      deliveryId: claim.delivery_id,
    });

    if (reply) {
      await saveWebhookReply(event, recipient, reply, claim.delivery_id);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await AIRCDB.exec`
      UPDATE webhook_deliveries
      SET status = 'failed', last_error = ${message}, updated_at = NOW()
      WHERE delivery_id = ${claim.delivery_id}
    `;
    log.warn("AIRC webhook delivery failed", {
      messageId: event.message.messageId,
      agentId: recipient.agent_id,
      error: message,
    });
    throw error;
  }
}

async function readJSONResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function saveWebhookReply(
  event: MessagePublishedEvent,
  recipient: RecipientRow,
  content: string,
  deliveryId: string,
): Promise<void> {
  try {
    await sendMessage({
      discussionId: event.message.discussionId,
      senderAgentId: recipient.agent_id,
      content,
      metadata: {
        inReplyToMessageId: event.message.messageId,
        webhookDeliveryId: deliveryId,
      },
    });
    log.info("saved AIRC webhook response", {
      messageId: event.message.messageId,
      agentId: recipient.agent_id,
      deliveryId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("unable to save AIRC webhook response", {
      messageId: event.message.messageId,
      agentId: recipient.agent_id,
      deliveryId,
      error: message,
    });
  }
}
