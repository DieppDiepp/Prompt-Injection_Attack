# AIRC Implementation Plan

This plan translates the current Encore TypeScript uptime-monitoring starter into the AIRC OSS MVP described in `README_AIRC.md`.

The current codebase is an event-driven Encore app with services for `site`, `monitor`, `slack`, and `frontend`. AIRC should reuse the Encore runtime shape where it helps: APIs, Pub/Sub, SQL databases, cron where needed, and the Next.js dashboard. Generated folders such as `encore.gen/` and `.encore/` must not be edited.

## Non-Negotiable Scope From README_AIRC.md

AIRC is an open interoperability runtime for AI agents. The MVP must deliver:

- Common message protocol
- Relay runtime
- TypeScript SDK
- Telegram demo
- Live event visualization
- Three heterogeneous agents communicating

The target ecosystem shape is:

```text
airc/
├── airc-runtime
├── airc-sdk-ts
├── airc-spec
├── airc-dashboard
├── adapters/
│   ├── langgraph
│   ├── autogen
│   ├── google-adk
│   ├── openai
│   └── custom
└── examples/
```

This repository does not need to be split into separate packages on day one unless that becomes necessary. The first implementation should preserve a simple Encore monorepo layout and name services after AIRC capabilities.

## Confirmed MVP Decisions - 2026-07-17

- Encore is the reference MVP runtime, not part of the public agent contract.
- Existing hosted agents connect through HTTP webhook push.
- Rooms broadcast each message to every active member except the sender.
- There is no orchestrator and no direct-message routing in protocol 0.1.
- A discussion defaults to 30 messages or five minutes and supports manual stop.
- The MVP has no application-level API authentication.
- Three webhook mock agents prove the relay before real LangGraph and OpenAI Agents SDK services are connected.
- The MVP stays in one repository and one primary `airc` Encore service. Protocol and SDK source remain independent of Encore so they can become packages later.

## Artifact Rule

All completed milestones and accepted artifacts must be recorded under the shared `artifacts/` folder.

For each milestone that passes acceptance:

- Add `artifacts/<milestone-id>-checklist.md`.
- Add `artifacts/<milestone-id>-summary.md`.
- The checklist must record acceptance criteria, verification commands, pass/fail status, and known gaps.
- The summary must record what changed, what decisions were made, and what remains next.
- If a milestone is partially complete, create or update a draft checklist with explicit unchecked items instead of marking it passed.

For each major artifact delivered inside a milestone:

- Add a short artifact entry to that milestone checklist.
- Link to the implementation files, docs, tests, generated clients, API examples, or UI screens that prove the artifact exists.

## Milestones

### M0 - Planning And Source Audit

Goal: establish a concrete migration plan from the Encore starter to AIRC without changing runtime behavior yet.

Work:

- Audit current services, routes, tests, migrations, frontend entry points, and package metadata.
- Identify which starter concepts map to AIRC concepts.
- Define milestone artifact tracking rules.
- Create initial `artifacts/` records for the planning phase.

Artifacts:

- `PLAN_AIRC.md`
- `artifacts/000-planning-checklist.md`
- `artifacts/000-planning-summary.md`

Acceptance:

- Plan includes milestones from protocol through demo/dashboard.
- Each milestone lists concrete deliverables and acceptance criteria.
- Artifact tracking rule is documented.

### M1 - Repository Identity And Service Skeleton

Goal: rename the application from the uptime starter into an AIRC OSS codebase and introduce service boundaries.

Work:

- Update project identity in `package.json`, root README content, and service comments.
- Keep `encore.app` as JSON text and update only intentional app metadata.
- Introduce AIRC service skeletons using Encore service folders:
  - `protocol` or `spec` for shared message definitions.
  - `runtime` for message relay and event bus.
  - `registry` for agent registration and lookup.
  - `gateway` for external user/API entrypoints.
  - `dashboard` or existing `frontend` for visualization.
- Decide whether to migrate or remove starter services:
  - `site` becomes obsolete unless reused as registry storage.
  - `monitor` becomes runtime/event history.
  - `slack` becomes obsolete unless replaced by Telegram integration.

Artifacts:

- Updated repository README for AIRC developer setup.
- Service skeleton files and Encore service definitions.
- `artifacts/001-service-skeleton-checklist.md`
- `artifacts/001-service-skeleton-summary.md`

Acceptance:

- `encore check` passes.
- No uptime-monitoring public API remains documented as primary product behavior.
- Generated folders are untouched.

### M2 - AIRC Protocol Specification

Goal: define the common communication contract agents use to interoperate.

Work:

- Define TypeScript interfaces for the AIRC protocol.
- Add a human-readable protocol spec document.
- Include message envelope fields needed for routing and observability:
  - message ID
  - conversation or session ID
  - sender agent ID
  - target agent ID or channel
  - message type
  - payload
  - created timestamp
  - correlation ID
  - optional capability metadata
- Define initial message types:
  - user input
  - agent message
  - tool request
  - tool result
  - status/event
  - error
- Define validation boundaries and API error behavior.

Artifacts:

- Protocol TypeScript module.
- Protocol markdown spec.
- Unit tests for protocol helpers and validation.
- `artifacts/002-protocol-checklist.md`
- `artifacts/002-protocol-summary.md`

Acceptance:

- Protocol types compile with strict TypeScript.
- Request/response examples exist.
- Invalid messages are rejected deterministically.

Open decision before implementation:

- Resolved for protocol 0.1: IDs are strings and the reference runtime generates UUIDs.

### M3 - AIRC Runtime Relay

Goal: implement the core relay runtime and event bus.

Work:

- Replace uptime checks with message relay endpoints.
- Create SQL migrations for event/message history.
- Create Pub/Sub topics for AIRC message delivery.
- Implement public/internal APIs:
  - publish message
  - fetch message history
  - fetch conversation/session events
  - list recent runtime events
- Use Encore Pub/Sub for async relay.
- Ensure handlers are idempotent because delivery is at-least-once.
- Sort event views by protocol publish sequence or timestamp chosen in M2, not by subscription insert order.

Artifacts:

- Runtime service.
- Message/event database migrations.
- Pub/Sub topic definitions.
- API tests for publish and history.
- Runtime verification notes using `encore check` or Encore local MCP.
- `artifacts/003-runtime-relay-checklist.md`
- `artifacts/003-runtime-relay-summary.md`

Acceptance:

- A message published through the API is persisted.
- A relay event is published to the bus.
- A subscriber can consume the event and record processing status.
- Tests cover duplicate delivery or idempotency behavior.

### M4 - Agent Registry And Capability Discovery Foundation

Goal: let agents join the network through a lightweight adapter contract.

Work:

- Implement agent registration APIs.
- Persist agent metadata and capabilities.
- Define adapter-facing registration and heartbeat contracts.
- Add basic capability search/listing.
- Keep this MVP-level; full long-term discovery can remain a later roadmap item.

Artifacts:

- Registry service and migrations.
- Agent registration endpoints.
- Capability schema.
- Tests for registration, lookup, and update.
- `artifacts/004-registry-checklist.md`
- `artifacts/004-registry-summary.md`

Acceptance:

- Agents can register with name, framework, endpoint/adapter metadata, and capabilities.
- Runtime can resolve a target agent by ID.
- Capability listing works for dashboard/demo use.

Open decision before implementation:

- Resolved for the demo MVP: registration and messaging are unsigned. Authentication remains a post-MVP production concern.

### M5 - TypeScript SDK

Goal: provide a lightweight TypeScript SDK that external or example agents can use.

Work:

- Add SDK module/package inside the repo.
- Implement client helpers for:
  - register agent
  - publish message
  - receive or poll events
  - acknowledge or report status if required by runtime design
- Export protocol types from the SDK.
- Add SDK examples and tests.

Artifacts:

- `airc-sdk-ts` source or repo-local SDK folder.
- SDK README.
- SDK tests.
- Example SDK consumer.
- `artifacts/005-sdk-ts-checklist.md`
- `artifacts/005-sdk-ts-summary.md`

Acceptance:

- An example agent can register and publish a protocol-valid message using the SDK.
- SDK uses Node.js v20+ built-in `fetch`.
- SDK uses ES modules and valid TypeScript.

### M6 - Demo Adapters And Three Heterogeneous Agents

Goal: prove interoperability through three different agent styles.

Work:

- Implement three demo agents that communicate through AIRC.
- Use real framework adapters only where dependencies and setup are confirmed.
- If framework dependencies are not approved yet, implement:
  - OpenAI-style adapter facade
  - LangGraph-style adapter facade
  - Custom local agent adapter
- Each adapter should translate between its local agent shape and the AIRC protocol.
- Add an example scenario where the agents collaborate through the runtime.

Artifacts:

- Adapter contracts.
- Three demo agent implementations.
- End-to-end demo script or Encore endpoint.
- Demo transcript fixture.
- `artifacts/006-demo-agents-checklist.md`
- `artifacts/006-demo-agents-summary.md`

Acceptance:

- Three agents register independently.
- A user/demo message enters through the gateway.
- At least three agent messages are relayed through AIRC.
- Event history shows cross-agent collaboration.

Open decision before implementation:

- Resolved for the first relay demo: use three webhook mocks. Connect the already-hosted LangGraph and OpenAI Agents SDK systems after the protocol/runtime boundary is stable.

### M7 - Telegram Demo Gateway

Goal: implement the Telegram demo from the MVP list.

Work:

- Add Telegram webhook/raw endpoint or polling integration.
- Use Encore secrets for Telegram bot token and webhook secret.
- Convert incoming Telegram messages to AIRC protocol messages.
- Relay runtime responses back to Telegram where applicable.
- Add local testing path that does not require a live Telegram webhook.

Artifacts:

- Telegram gateway service or module.
- Secret definitions and setup docs.
- Local webhook test fixture.
- Integration tests around request parsing and protocol conversion.
- `artifacts/007-telegram-demo-checklist.md`
- `artifacts/007-telegram-demo-summary.md`

Acceptance:

- Telegram-shaped inbound payload becomes a valid AIRC message.
- Runtime can process the message through demo agents.
- Response path is documented and testable.

Open decision before implementation:

- Confirm whether the MVP requires an actual deployed Telegram bot or a local/demo-compatible webhook implementation.

### M8 - Live Event Dashboard

Goal: repurpose the existing Next.js frontend into the AIRC live collaboration dashboard.

Work:

- Replace uptime UI with AIRC runtime views.
- Show registered agents and capabilities.
- Show conversations, message flow, event history, and processing status.
- Add refresh or live update behavior appropriate for MVP.
- Regenerate Encore client when APIs change.

Artifacts:

- Dashboard screens in `frontend/`.
- Generated local client, if required.
- UI verification notes or screenshots.
- `artifacts/008-dashboard-checklist.md`
- `artifacts/008-dashboard-summary.md`

Acceptance:

- Dashboard loads at the Encore frontend route.
- It shows agents and recent AIRC messages.
- It can visualize a demo conversation involving three agents.
- Text and layout are checked on desktop and mobile widths.

### M9 - Documentation, OSS Readiness, And Release Candidate

Goal: make the project understandable and usable as an OSS MVP.

Work:

- Rewrite README with product positioning, architecture, setup, and demo walkthrough.
- Add protocol documentation.
- Add SDK documentation.
- Add adapter authoring guide.
- Add contribution and license notes as needed.
- Ensure examples are runnable from documented commands.

Artifacts:

- Root README.
- Protocol docs.
- SDK docs.
- Adapter guide.
- Example walkthrough.
- Final artifact index.
- `artifacts/009-oss-readiness-checklist.md`
- `artifacts/009-oss-readiness-summary.md`

Acceptance:

- A new developer can run the app locally using documented steps.
- MVP demo has a documented happy path.
- Tests and `encore check` pass.
- Artifact folder contains summaries/checklists for all passed milestones.

## Verification Strategy

Use the following verification ladder as implementation progresses:

- Static checks: TypeScript compile through Encore.
- Unit tests: protocol helpers, SDK helpers, registry logic, adapter translation.
- Service tests: Encore API function calls and database behavior.
- Runtime checks: `encore check` for app boot and endpoint smoke tests.
- Pub/Sub checks: Encore local MCP `wait_for_subscription_message` for async relay verification when available.
- Trace checks: Encore local MCP `get_traces` and `get_trace_spans` for failed request or Pub/Sub debugging.
- Dashboard checks: run the frontend and inspect desktop/mobile layout before marking dashboard milestones passed.

## Questions To Confirm Before Implementation

These points should be confirmed before the relevant milestone starts:

- Should the repo remain a single Encore monorepo for MVP, or should it be split into separate workspace packages matching `airc-runtime`, `airc-sdk-ts`, and `airc-dashboard` immediately?
- Which three heterogeneous agents are required for MVP: real LangGraph/AutoGen/OpenAI integrations, or adapter facades plus one real SDK-backed demo?
- Should agent registration be unauthenticated for local MVP, or should it include token-based auth from the start?
- Should Telegram be implemented as a live deployed bot requirement or as a webhook-compatible local demo first?
- What license should the OSS project use? `package.json` currently says `MPL-2.0`.
