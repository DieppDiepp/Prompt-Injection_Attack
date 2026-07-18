# 009 — Red-team MVP checklist

Status: draft — source implementation complete; full Encore runtime verification
is pending local CLI/dependency recovery.

## Acceptance criteria

- [x] A target can be configured in local-prompt or AIRC-webhook mode.
- [x] Ground truth is stored server-side and omitted from target/session API responses.
- [x] Vietnamese Analyst, Strategist and Lead produce and persist one probe per attack round.
- [x] Each response gets a deterministic `none` / `acknowledges` / `partial` /
  `verbatim` assessment; `verbatim` ends the attack early.
- [x] A final LLM judge uses ground truth and transcript; the more severe result wins.
- [x] Normal-question interactions are persisted for false-positive evaluation.
- [x] Dashboard provides separate council and target/run tabs in Vietnamese.
- [x] `.env` is ignored and `.env.example` documents the required key.
- [x] OpenAI API key and `gpt-5.4-mini` were verified with a harmless request.
- [x] The detector source type-checks in isolation.
- [ ] `encore test` passes with full local dependency and infrastructure setup.
- [ ] `encore check` passes and the UI is visually checked in a local browser.

## Implementation evidence

- Runtime API: [redteam/api.ts](../redteam/api.ts)
- Persistence: [redteam migration](../redteam/migrations/001_create_redteam.up.sql)
- Target adapters: [redteam/target.ts](../redteam/target.ts)
- Detector tests: [redteam/leak-detector.test.ts](../redteam/leak-detector.test.ts)
- Dashboard: [frontend/app/page.tsx](../frontend/app/page.tsx)
- Webhook guide: [docs/red-team-webhook.md](../docs/red-team-webhook.md)
