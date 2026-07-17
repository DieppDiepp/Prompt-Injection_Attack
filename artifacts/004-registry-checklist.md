# M4 Registry Checklist

Status: passed for MVP

- [x] Agents register an ID, name, webhook URL, framework, and capabilities.
- [x] Registration is idempotent and updates existing agent metadata.
- [x] Agents can join persistent rooms.
- [x] Agent and room listing endpoints exist.
- [x] Webhook URLs are validated as HTTP or HTTPS.

Artifacts: registry endpoints in `airc/api.ts` and registry tables in
`airc/migrations/001_create_airc.up.sql`.

Known gap: registration is intentionally unauthenticated for this MVP.
