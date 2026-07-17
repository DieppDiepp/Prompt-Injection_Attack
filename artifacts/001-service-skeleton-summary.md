# M1 Service Skeleton Summary

Status: passed

The repository now identifies as AIRC. The MVP uses one primary Encore service
for the runtime and a separate mock-agent service for demonstration. Protocol
and SDK code are framework-independent and can become standalone packages in a
later release.

The Encore-hosted Next.js service was retained and repurposed. The legacy
uptime `monitor`, `site`, and `slack` services were removed after the dashboard
stopped depending on them.
