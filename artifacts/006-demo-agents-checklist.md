# M6 Demo Agents Checklist

Status: partial

- [x] Three agents register independently through the same registry contract.
- [x] All three receive a broadcast webhook.
- [x] Every mock posts one response back to the discussion.
- [x] E2E history contains the seed plus three ordered agent acknowledgements.
- [ ] Connect the hosted LangGraph agent.
- [ ] Connect the hosted OpenAI Agents SDK agent.
- [ ] Demonstrate a real multi-agent discussion beyond acknowledgement mocks.

Artifacts: `mockagent/mock.ts`, `docs/webhook-agent-guide.md`.

This milestone remains partial until real heterogeneous agents are connected.
