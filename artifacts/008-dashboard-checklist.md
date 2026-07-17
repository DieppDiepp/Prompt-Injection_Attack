# M8 Dashboard Checklist

Status: partial

- [x] Reused the existing Encore-hosted Next.js frontend service.
- [x] Removed the uptime generated client and all uptime UI behavior.
- [x] Displays room agents and active/offline state.
- [x] Displays ordered discussion messages and sender identity.
- [x] Displays message quota, run status, remaining window, and delivery mode.
- [x] Broadcast action initializes the demo room and triggers all mock agents.
- [x] Stop action terminates an active discussion.
- [x] Operators can create a room with a generated or stable room ID.
- [x] Manual onboarding registers a hosted webhook agent and joins it to the selected room.
- [x] Self-registration mode exposes runtime, room, registration, join, and reply contracts.
- [x] Self-registration bootstrap configuration can be copied from the dashboard.
- [x] Loading, empty, runtime error, hover, active, and keyboard focus states exist.
- [x] Responsive CSS breakpoints exist for desktop, tablet, and mobile layouts.
- [x] Frontend strict TypeScript check passes.
- [x] Next.js production build passes.
- [x] Live server returns HTTP 200 and AIRC Control Room HTML.
- [x] Live relay check produced one seed and three mock-agent responses.
- [x] Onboarding smoke test created a room, registered a LangGraph-shaped hosted agent, joined it, and read it back as a room member.
- [x] Broadcast targets the currently selected room; only `demo-lobby` invokes mock-agent setup.
- [x] Operators can remove an agent from the selected room without deleting its global registration.
- [x] Removed demo agents are not automatically rejoined on later broadcasts.
- [ ] Capture and inspect desktop and mobile browser screenshots.

Artifacts: `frontend/app/page.tsx`, `frontend/app/globals.css`,
`frontend/app/layout.tsx`, room read APIs in `airc/api.ts`.

Known gap: the in-app browser was unavailable in this session, so visual
screenshot inspection remains required before marking M8 fully passed.

Dependency audit note: `npm` reports 10 vulnerabilities in the current tree
(1 low, 3 moderate, 3 high, 3 critical). No forced dependency upgrades were
applied because they may introduce breaking changes before the demo.
