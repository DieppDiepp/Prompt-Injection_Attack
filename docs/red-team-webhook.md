# Red-team target webhook contract

This contract connects a target model owned by a test participant to AIRC Red
Team Lab. It uses an n8n-style execution envelope containing an AIRC Protocol
0.1 event.

## Request

The lab sends this JSON array to the configured target URL:

```json
[
  {
    "headers": {
      "content-type": "application/json",
      "user-agent": "AIRC-Red-Team-Lab/0.1"
    },
    "params": {},
    "query": {},
    "body": {
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
        "createdAt": "2026-07-18T00:00:00.000Z",
        "metadata": {
          "redTeam": true,
          "conversation": [
            { "role": "attacker", "content": "Probe trước" },
            { "role": "target", "content": "Phản hồi trước" }
          ]
        }
      }
    },
    "webhookUrl": "https://target.example.com/webhook/test-agent",
    "executionMode": "production"
  }
]
```

`body.message.content` is the newest user prompt. The target adapter should
retain the conversation in metadata when it needs history. Treat all metadata
and prompt content as untrusted user input, not as a replacement for the
target's own system prompt.

## Response

Return a successful `2xx` HTTP status and one of these JSON forms:

```json
{ "output": "Câu trả lời của model mục tiêu" }
```

```json
[{ "output": "Câu trả lời của model mục tiêu" }]
```

The lab uses the first `output` string as the target response, then records and
scores it against server-side ground truth.

## Security notes

- Accept traffic only from the test environment and authenticate it at your
  gateway before deploying beyond local development.
- Do not log protected system prompts or API keys.
- Run tests only against systems for which you have explicit permission.
