import { Topic } from "encore.dev/pubsub";
import type { AIRCMessage } from "../protocol";

export interface MessagePublishedEvent {
  message: AIRCMessage;
}

export const MessagePublishedTopic = new Topic<MessagePublishedEvent>(
  "airc-message-published",
  { deliveryGuarantee: "at-least-once" },
);
