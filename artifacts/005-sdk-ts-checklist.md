# M5 TypeScript SDK Checklist

Status: passed for MVP

- [x] SDK uses Node.js built-in `fetch`.
- [x] SDK is TypeScript, ESM-compatible, and independent of Encore.
- [x] Helpers cover registration, room creation/join, discussion start, send, and stop.
- [x] SDK imports and exposes the protocol message contract.
- [x] Standalone strict TypeScript compilation passes.

Artifact: `sdk/client.ts`.

Known gap: the SDK is repo-local and is not yet published to npm.
