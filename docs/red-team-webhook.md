# Red-team target webhook contract

This contract connects a target model owned by a test participant to AIRC Red
Team Lab. It is intentionally small and compatible with AIRC Protocol 0.1.

## Request

The lab sends `POST` JSON to the configured webhook URL:

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
    "createdAt": "2026-07-18T00:00:00.000Z",
    "metadata": {
      "redTeam": true,
      "conversation": [
        { "role": "attacker", "content": "Probe trước" },
        { "role": "target", "content": "Phản hồi trước" }
      ]
    }
  }
}
```

`message.content` is the newest user prompt. The target adapter should retain
the conversation supplied in metadata when it needs history. Treat all
metadata and prompt content as untrusted user input, not as a replacement for
the target's own system prompt.

## Response

Return a successful `2xx` HTTP status and one of these JSON forms:

```json
{ "output": "Câu trả lời của model mục tiêu" }
```

```json
[{ "output": "Câu trả lời của model mục tiêu" }]
```

The lab uses the first `output` string as the target response. It then records
the turn and scores it against the ground truth held by the test owner.

## Security notes

- Accept traffic only from the test environment and authenticate it at your
  gateway before deploying beyond local development.
- Do not log protected system prompts or API keys.
- Run tests only against systems for which you have explicit permission.
