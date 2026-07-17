# M8 Dashboard Summary

Status: partial

The legacy uptime frontend is now an AIRC control room. It visualizes the agent
roster, room timeline, delivery sequence, and bounded discussion state, and it
can start or stop the live mock-agent demo without curl. The dashboard uses the
same public HTTP endpoints available to any client and does not import or alter
the external AIRC SDK.

Functional verification, strict TypeScript checking, production build, and a
live four-message relay passed. Desktop/mobile screenshot inspection remains
open because no in-app browser was attached to the session.
