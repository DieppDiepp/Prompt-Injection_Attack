# M1 Service Skeleton Checklist

Status: passed

- [x] Root package identity changed from uptime tutorial to AIRC.
- [x] Root README describes AIRC as the primary product.
- [x] Added the `airc` Encore service and `mockagent` demo service.
- [x] Kept protocol and SDK outside Encore service ownership.
- [x] Did not edit `encore.gen/` or `.encore/`.
- [x] `encore check` compiles, migrates, boots, and reports healthy.

Artifacts: `README.md`, `package.json`, `airc/encore.service.ts`,
`mockagent/encore.service.ts`.

The uptime `monitor`, `site`, and `slack` services were removed after their
Encore-hosted Next.js frontend was repurposed for AIRC.
