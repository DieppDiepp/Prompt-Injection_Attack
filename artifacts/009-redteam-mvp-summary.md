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

The dashboard was redesigned around two tabs so operators can separate internal
attacker reasoning from target configuration, target transcript and benign
questions. Both local system-prompt evaluation and remote AIRC webhook targets
are supported.

Known gap: this workstation has a partially created, Windows-locked
`node_modules` directory and no Encore CLI, so full infrastructure and visual
runtime checks remain pending. A direct harmless OpenAI Responses request did
verify the provided local key and `gpt-5.4-mini` model.
