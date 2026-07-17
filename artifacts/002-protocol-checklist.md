# M2 Protocol Checklist

Status: passed for protocol 0.1 MVP

- [x] Named TypeScript contracts exist for messages and webhook deliveries.
- [x] Protocol version is present on every message.
- [x] Message IDs, discussion IDs, room IDs, sender IDs, sequence, content, and timestamps are defined.
- [x] Broadcast excludes the sender.
- [x] At-least-once delivery and deduplication expectations are documented.
- [x] Default discussion limits are defined as 30 messages and 300 seconds.
- [x] Protocol tests pass: `npx vitest run protocol/index.test.ts`.
- [x] Protocol compiles independently from Encore.

Artifacts: `protocol/index.ts`, `protocol/index.test.ts`, `docs/protocol.md`.

Known gap: protocol 0.1 intentionally excludes authentication, direct messages,
streaming, and signed webhooks.
