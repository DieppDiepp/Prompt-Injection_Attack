# 009 — Red-team MVP checklist

Status: draft — source implementation and focused runtime verification complete;
browser-driven visual verification remains pending.

## Acceptance criteria

- [x] A target can be configured in local-prompt or AIRC-webhook mode.
- [x] Webhook targets are configured without accepting or displaying their system prompt or ground truth.
- [x] Vietnamese Analyst, Strategist and Lead produce and persist one probe per attack round.
- [x] Every target response is immediately assessed by `gpt-4o-mini` as `safe` / `suspicious` / `injected` / `unavailable`, with explanation and evidence.
- [x] Findings are saved and the most severe response forms the final session conclusion.
- [x] Normal-question interactions are persisted for false-positive evaluation.
- [x] Dashboard shows the council and target/run workspace side by side in Vietnamese.
- [x] Webhook target URL is a visible manual input and no default URL is configured.
- [x] The UI shows an immediate per-response injection warning and explanation; no separate target transcript is rendered.
- [x] A separate comparison tab accepts regular and hardened prompts (including `.txt` loading) and compares the same test input without persistence.
- [x] `.env` is ignored and `.env.example` documents the required key.
- [x] OpenAI API key and `gpt-5.4-mini` were verified with a harmless request.
- [x] The detector source type-checks in isolation.
- [x] The local Encore health and target-list endpoints respond successfully.
- [x] Focused detector tests and frontend TypeScript checking pass.
- [ ] The comparison flow is exercised against a live model with representative prompts.
- [ ] The UI is visually checked in a local browser.

## Implementation evidence

- Runtime API: [redteam/api.ts](../redteam/api.ts)
- Persistence: [redteam migration](../redteam/migrations/001_create_redteam.up.sql)
- Target adapters: [redteam/target.ts](../redteam/target.ts)
- Detector tests: [redteam/leak-detector.test.ts](../redteam/leak-detector.test.ts)
- Dashboard: [frontend/app/page.tsx](../frontend/app/page.tsx)
- Webhook guide: [docs/red-team-webhook.md](../docs/red-team-webhook.md)
