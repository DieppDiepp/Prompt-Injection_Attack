# M3 Runtime Relay Summary

Status: passed for MVP

The Encore runtime now behaves as an IRC-like room relay. A message is persisted,
published through Encore Pub/Sub, pushed to all other members, and exposed in
ordered discussion history. Quota, expiry, stop, and delivery deduplication are
implemented.
