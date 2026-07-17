
# AIRC

> **Open Interoperability Runtime for AI Agents**

AIRC is an open-source runtime that enables AI agents built with different frameworks to communicate and collaborate through a common communication layer.

Instead of building yet another multi-agent framework, AIRC focuses on **interoperability**. Existing agents remain independent and only need a lightweight adapter to join the network.

---

## Why AIRC?

Today, every AI framework builds its own ecosystem.

- LangGraph
- AutoGen
- Google ADK
- OpenAI Agents SDK
- CrewAI
- Custom Agents

While each framework is powerful, agents from different ecosystems rarely work together without custom integrations.

AIRC provides a lightweight runtime and protocol that allows heterogeneous AI agents to collaborate through a shared event bus.

---

## Vision

> **The Internet for AI Agents**

Inspired by:

- The simplicity of IRC
- The openness of HTTP
- Modern event-driven distributed systems

AIRC aims to become the open interoperability layer connecting AI agents across frameworks.

---

## Philosophy

- 🚀 Open Source First
- 🔌 Framework Agnostic
- 🧩 Adapter-based Integration
- 🏠 Self-host Friendly
- 📡 Event-driven Architecture
- 🤝 Community Driven

---

## Architecture

```text
User / Telegram / API
          │
          ▼
     AIRC Gateway
          │
          ▼
     AIRC Runtime
          │
   ┌──────┼────────┐
   ▼      ▼        ▼
 LangGraph AutoGen Custom Agent
```

Each agent only needs to implement the AIRC adapter.

---

## Core Components

- **AIRC Runtime** — Message routing & event bus
- **AIRC Protocol** — Common communication specification
- **AIRC SDK** — Simple API for agent integration
- **Adapters** — Connect existing frameworks
- **Dashboard** — Visualize agent collaboration

---

## Planned Ecosystem

```
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

---

## MVP

- Common message protocol
- Relay runtime
- TypeScript SDK
- Telegram demo
- Live event visualization
- 3 heterogeneous agents communicating

---

## Long-term Roadmap

- Capability Discovery
- Agent Registry
- Channels
- Broadcast
- Multi-language SDKs
- Observability
- Plugin Marketplace

---

## Elevator Pitch

> Docker standardized containers. HTTP standardized web communication.
> **AIRC standardizes interoperability between AI agents.**

Build once. Connect everywhere.
