# 009 — Red-team MVP summary

The repository now contains an authorised prompt-extraction evaluation harness.
It retains AIRC's webhook envelope while adding a dedicated `redteam` Encore
service with private target configuration, session history, attacker council
deliberations, detector evidence and final findings.

The attacker council intentionally does not receive the protected ground truth.
It sees only target responses and produces Vietnamese probes through
`gpt-5.4-mini`. The protected content is used only by the rule-based detector
and an independent final judge. A verbatim finding ends the automated attack;
otherwise the session ends at the configured number of rounds or on operator
finalization.

The dashboard shows the council alongside target configuration, target
transcript and benign questions. Target webhook URLs are always entered manually
by the operator; the application contains no default target URL. A separate
comparison tab runs regular and hardened prompts independently against the same
test input without calling a webhook or persisting either prompt. Both local
system-prompt evaluation and remote AIRC webhook targets are supported.

Known gap: browser-driven visual verification is pending because this Windows
environment blocks the browser automation setup. The local Encore runtime,
health route and target-list endpoint were verified, and the focused TypeScript
and detector test checks pass.
