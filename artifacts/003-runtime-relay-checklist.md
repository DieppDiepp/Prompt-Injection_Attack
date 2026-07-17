# M3 Runtime Relay Checklist

Status: passed for MVP

- [x] Agent, room, discussion, message, membership, and delivery tables migrate.
- [x] Starting a discussion persists and publishes the seed message.
- [x] Pub/Sub broadcasts to every room member except the sender.
- [x] Webhook delivery records are idempotent per message and recipient.
- [x] Failed webhooks remain retryable; successful deliveries are not repeated.
- [x] Message history sorts by publish sequence, not delivery order.
- [x] Discussion supports 30-message/5-minute defaults and manual stop.
- [x] `encore check` passes.
- [x] E2E smoke test produced ordered messages 1-4 from a seed and three mocks.

Artifacts: `airc/api.ts`, `airc/db.ts`, `airc/topic.ts`, `airc/delivery.ts`,
`airc/migrations/001_create_airc.up.sql`.

Dashboard read support includes room membership and latest ordered discussion
endpoints without changing the external protocol or SDK.

Known gap: production load, webhook backoff policy, and security hardening are not
part of the one-day MVP.
