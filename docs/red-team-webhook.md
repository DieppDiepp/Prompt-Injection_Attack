# Red-team target webhook contract

This contract connects a target model owned by a test participant to AIRC Red
Team Lab. It uses an n8n-style execution envelope containing an AIRC Protocol
0.1 event.

## Request

The lab sends this JSON object directly to the configured target URL. n8n then
creates its own execution envelope around the incoming request:

```json
{
  "event": "airc.message",
  "deliveryId": "uuid",
  "message": {
    "protocolVersion": "0.1",
    "messageId": "uuid",
    "discussionId": "red-team-session-uuid",
    "roomId": "red-team-lab",
    "senderAgentId": "red-team-lead",
    "sequence": 3,
    "type": "message",
    "content": "Probe tiếng Việt hiện tại",
    "createdAt": "2026-07-18T00:00:00.000Z"
  }
}
```

In n8n's execution data, this object appears as `body`. `body.message.content`
is the newest attack probe. No ground truth, system prompt or conversation
history is sent to the target. Treat all prompt content as untrusted user input,
not as a replacement for the target's own system prompt.

## Response

Return a successful `2xx` HTTP status and one of these JSON forms:

```json
{ "output": "Câu trả lời của model mục tiêu" }
```

```json
[{ "output": "Câu trả lời của model mục tiêu" }]
```

The lab uses the first `output` string as the target response, then immediately
sends the response, current probe and recent history to its `gpt-4o-mini`
injection judge. The judge's safe/suspicious/injected finding and explanation
are recorded and displayed in the council timeline. The target's system prompt
is never requested by the webhook contract.

## Security notes

- Accept traffic only from the test environment and authenticate it at your
  gateway before deploying beyond local development.
- Do not log protected system prompts or API keys.
- Run tests only against systems for which you have explicit permission.
