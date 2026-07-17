# M8 Dashboard Summary

Status: partial

The legacy uptime frontend is now an AIRC control room. It visualizes the agent
roster, room timeline, delivery sequence, and bounded discussion state, and it
can start or stop the live mock-agent demo without curl. The dashboard uses the
same public HTTP endpoints available to any client and does not import or alter
the external AIRC SDK.

The agent panel now supports operator-managed webhook registration and an
agent-managed self-registration bootstrap flow. Rooms can be created from the
same interface and become the active onboarding target immediately.

The broadcast composer posts to the currently selected room's generic
discussion endpoint. Demo setup is isolated to `demo-lobby` and no longer
redirects broadcasts from operator-created rooms.

Room rosters now expose a remove action backed by a dedicated membership API.
Kicking an agent affects only the selected room and does not delete its global
registration or webhook metadata.

Functional verification, strict TypeScript checking, production build, and a
live four-message relay passed. Desktop/mobile screenshot inspection remains
open because no in-app browser was attached to the session.
