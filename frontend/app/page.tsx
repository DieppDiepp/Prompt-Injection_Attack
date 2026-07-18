"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

type TargetMode = "webhook" | "local";
type LeakSeverity = "none" | "acknowledges" | "partial" | "verbatim";
type InjectionStatus = "safe" | "suspicious" | "injected" | "unavailable";
type SessionStatus = "active" | "stopped" | "completed" | "leaked";
type CouncilRoundStatus = "analysing" | "analyst_ready" | "strategizing" | "strategist_ready" | "leading" | "lead_ready" | "dispatching" | "completed";

interface Target {
  targetId: string;
  name: string;
  mode: TargetMode;
  webhookUrl?: string;
  createdAt: string;
}

interface Interaction {
  interactionId: string;
  ordinal: number;
  roundNumber?: number;
  kind: "probe" | "benign";
  prompt: string;
  targetResponse: string;
  analyst?: string;
  strategies: string[];
  leadReasoning?: string;
  injectionStatus: InjectionStatus;
  injectionReason: string;
  injectionEvidence: string[];
  targetLatencyMs?: number;
  createdAt: string;
}

interface Session {
  sessionId: string;
  target: Target;
  status: SessionStatus;
  maxTurns: number;
  attackTurnCount: number;
  attackerContext: string;
  finalInjectionStatus?: InjectionStatus;
  finalInjectionReason?: string;
  finalInjectionEvidence: string[];
  createdAt: string;
  completedAt?: string;
  interactions: Interaction[];
}

interface PromptComparisonResult {
  response: string;
  latencyMs: number;
  severity?: LeakSeverity;
  evidence: string[];
}

interface PromptComparison {
  regular: PromptComparisonResult;
  defended: PromptComparisonResult;
}

interface LiveCouncilRound {
  roundId: string;
  sessionId: string;
  roundNumber: number;
  status: CouncilRoundStatus;
  analyst?: string;
  strategies: string[];
  leadReasoning?: string;
  probe?: string;
  createdAt: string;
  updatedAt: string;
}

interface DispatchRoundResponse {
  round: LiveCouncilRound;
  session: Session;
}

class HTTPError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body
      ? { "Content-Type": "application/json", ...init.headers }
      : init?.headers,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new HTTPError(response.status, parseError(body));
  }
  return (await response.json()) as T;
}

export default function RedTeamLab() {
  const [view, setView] = useState<"lab" | "compare">("lab");
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [liveRound, setLiveRound] = useState<LiveCouncilRound | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"target" | "session" | "advance" | "benign" | "finalize" | "stop" | "compare" | null>(null);
  const [maxTurns, setMaxTurns] = useState("6");
  const [attackerContext, setAttackerContext] = useState("");
  const [normalQuestion, setNormalQuestion] = useState("");
  const [targetForm, setTargetForm] = useState({
    webhookUrl: "",
  });
  const [comparisonForm, setComparisonForm] = useState({
    regularPrompt: "",
    defendedPrompt: "",
    testPrompt: "",
    protectedContent: "",
  });
  const [comparison, setComparison] = useState<PromptComparison | null>(null);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.targetId === selectedTargetId),
    [selectedTargetId, targets],
  );
  useEffect(() => {
    void refreshTargets();
  }, []);

  async function refreshTargets() {
    try {
      const result = await requestJSON<{ targets: Target[] }>("/v1/red-team/targets");
      setTargets(result.targets);
      setSelectedTargetId((current) => current || result.targets[0]?.targetId || "");
    } catch (caught) {
      showError(caught);
    }
  }

  async function createTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("target");
    clearMessages();
    try {
      const target = await requestJSON<Target>("/v1/red-team/targets", {
        method: "POST",
        body: JSON.stringify(targetForm),
      });
      await refreshTargets();
      setSelectedTargetId(target.targetId);
      setTargetForm({ webhookUrl: "" });
      setNotice("Webhook target saved. GPT-4o-mini will assess every response for injection as soon as it arrives.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function createSession() {
    if (!selectedTargetId) return;
    if (!attackerContext.trim()) {
      setError("Enter a short target-topic context so the council can choose relevant test directions.");
      return;
    }
    setBusy("session");
    clearMessages();
    try {
      const created = await requestJSON<Session>("/v1/red-team/sessions", {
        method: "POST",
        body: JSON.stringify({
          targetId: selectedTargetId,
          maxTurns: Number(maxTurns),
          attackerContext: attackerContext.trim(),
        }),
      });
      setSession(created);
      setNotice("Session ready. Start the first round to let the council create its first probe.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function updateSession(action: "advance" | "finalize" | "stop") {
    if (!session) return;
    setBusy(action);
    clearMessages();
    try {
      const updated = await requestJSON<Session>(`/v1/red-team/sessions/${session.sessionId}/${action}`, {
        method: "POST",
      });
      setSession(updated);
      if (updated.status !== "active") setNotice("The session has ended and has a final finding.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function runLiveRound() {
    if (!session) return;
    setBusy("advance");
    clearMessages();
    const now = new Date().toISOString();
    setLiveRound({
      roundId: "pending",
      sessionId: session.sessionId,
      roundNumber: session.attackTurnCount + 1,
      status: "analysing",
      strategies: [],
      createdAt: now,
      updatedAt: now,
    });
    try {
      let round = await requestJSON<LiveCouncilRound>(`/v1/red-team/sessions/${session.sessionId}/rounds/begin`, {
        method: "POST",
      });
      setLiveRound(round);
      await waitForPaint();

      if (round.status === "analyst_ready") {
        setLiveRound({ ...round, status: "strategizing" });
        round = await requestJSON<LiveCouncilRound>(`/v1/red-team/rounds/${round.roundId}/strategize`, {
          method: "POST",
        });
        setLiveRound(round);
        await waitForPaint();
      }

      if (round.status === "strategist_ready") {
        setLiveRound({ ...round, status: "leading" });
        round = await requestJSON<LiveCouncilRound>(`/v1/red-team/rounds/${round.roundId}/lead`, {
          method: "POST",
        });
        setLiveRound(round);
        await waitForPaint();
      }

      if (round.status !== "lead_ready") {
        throw new Error("The council round is not ready to dispatch to the target.");
      }
      setLiveRound({ ...round, status: "dispatching" });
      const dispatched = await requestJSON<DispatchRoundResponse>(`/v1/red-team/rounds/${round.roundId}/dispatch`, {
        method: "POST",
      });
      setSession(dispatched.session);
      setLiveRound(null);
      if (dispatched.session.status !== "active") setNotice("The session has ended and has a final finding.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function sendNormalQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !normalQuestion.trim()) return;
    setBusy("benign");
    clearMessages();
    try {
      const updated = await requestJSON<Session>(`/v1/red-team/sessions/${session.sessionId}/benign`, {
        method: "POST",
        body: JSON.stringify({ content: normalQuestion }),
      });
      setSession(updated);
      setNormalQuestion("");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function comparePrompts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("compare");
    clearMessages();
    try {
      const result = await requestJSON<PromptComparison>("/v1/red-team/compare", {
        method: "POST",
        body: JSON.stringify({
          ...comparisonForm,
          protectedContent: comparisonForm.protectedContent.trim() || undefined,
        }),
      });
      setComparison(result);
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function loadDefendedPrompt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setComparisonForm((current) => ({ ...current, defendedPrompt: content }));
    setNotice(`${file.name} loaded. Its contents stay in your browser until you run the comparison.`);
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  function showError(caught: unknown) {
    const message = caught instanceof Error ? caught.message : "An unknown error occurred.";
    setError(message);
  }

  return (
    <main className="rt-shell">
      <header className="rt-header">
        <div>
          <p className="rt-eyebrow">AIRC · RED TEAM LAB</p>
          <h1>Measure system-prompt resilience</h1>
          <p className="rt-subtitle">
            An attacker council probes the target; GPT-4o-mini assesses every reply for injection immediately.
          </p>
        </div>
        <div className="rt-model-badge"><span />Council GPT-5.4-mini · Judge GPT-4o-mini</div>
      </header>

      <div className="rt-safety-note">
        Test only models, webhooks, and prompts you are authorized to assess. Do not place real secrets in public environments.
      </div>

      <nav className="rt-view-tabs" aria-label="Workspace mode">
        <button className={view === "lab" ? "active" : ""} onClick={() => setView("lab")} type="button">Red-team lab</button>
        <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")} type="button">Compare prompts</button>
      </nav>

      {error && <p className="rt-banner error" role="alert">{error}</p>}
      {notice && <p className="rt-banner notice">{notice}</p>}

      {view === "lab" ? <div className="rt-parallel-workspace">
        <section className="rt-workspace-column" aria-labelledby="council-title">
          <div className="rt-workspace-heading"><span>01</span><div><p className="rt-eyebrow">COUNCIL</p><h2 id="council-title">Attacker council</h2></div></div>
          <CouncilTab
            busy={busy}
            liveRound={liveRound}
            onAdvance={() => void runLiveRound()}
            onFinalize={() => void updateSession("finalize")}
            session={session}
          />
        </section>
        <section className="rt-workspace-column" aria-labelledby="target-title">
          <div className="rt-workspace-heading"><span>02</span><div><p className="rt-eyebrow">TARGET</p><h2 id="target-title">Target &amp; run</h2></div></div>
          <TargetTab
            busy={busy}
            form={targetForm}
            attackerContext={attackerContext}
            maxTurns={maxTurns}
            normalQuestion={normalQuestion}
            onCreateTarget={createTarget}
            onCreateSession={() => void createSession()}
            onAttackerContextChange={setAttackerContext}
            onFinalize={() => void updateSession("finalize")}
            onFormChange={setTargetForm}
            onMaxTurnsChange={setMaxTurns}
            onNormalQuestionChange={setNormalQuestion}
            onRefresh={() => void refreshTargets()}
            onSendNormal={sendNormalQuestion}
            onSelectedTargetChange={setSelectedTargetId}
            onStop={() => void updateSession("stop")}
            selectedTarget={selectedTarget}
            selectedTargetId={selectedTargetId}
            session={session}
            targets={targets}
          />
        </section>
      </div> : <PromptComparisonTab
        busy={busy}
        comparison={comparison}
        form={comparisonForm}
        onChange={setComparisonForm}
        onLoadDefendedPrompt={(event) => void loadDefendedPrompt(event)}
        onSubmit={comparePrompts}
      />}
    </main>
  );
}

function PromptComparisonTab({
  busy,
  comparison,
  form,
  onChange,
  onLoadDefendedPrompt,
  onSubmit,
}: {
  busy: string | null;
  comparison: PromptComparison | null;
  form: { regularPrompt: string; defendedPrompt: string; testPrompt: string; protectedContent: string };
  onChange: (form: { regularPrompt: string; defendedPrompt: string; testPrompt: string; protectedContent: string }) => void;
  onLoadDefendedPrompt: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="rt-comparison-page">
      <article className="rt-panel rt-comparison-intro">
        <p className="rt-eyebrow">SAME INPUT, TWO PROMPTS</p>
        <h2>Regular vs hardened prompt</h2>
        <p>
          Both prompts run independently against the same input via GPT-5.4-mini. This tab never calls the target
          webhook and does not store either prompt in the database.
        </p>
      </article>

      <form className="rt-comparison-form" onSubmit={onSubmit}>
        <article className="rt-panel">
          <p className="rt-eyebrow">A · BASELINE</p>
          <h2>Regular prompt</h2>
          <label className="rt-field">System prompt without a defensive layer
            <textarea
              onChange={(event) => onChange({ ...form, regularPrompt: event.target.value })}
              placeholder="Paste a baseline prompt…"
              required
              rows={16}
              value={form.regularPrompt}
            />
          </label>
        </article>

        <article className="rt-panel">
          <p className="rt-eyebrow">B · HARDENED</p>
          <h2>Hardened prompt</h2>
          <label className="rt-upload">Load from .txt
            <input accept="text/plain,.txt" onChange={onLoadDefendedPrompt} type="file" />
          </label>
          <label className="rt-field">System prompt with defensive guardrails
            <textarea
              onChange={(event) => onChange({ ...form, defendedPrompt: event.target.value })}
              placeholder="Paste or load a hardened prompt…"
              required
              rows={16}
              value={form.defendedPrompt}
            />
          </label>
        </article>

        <article className="rt-panel rt-comparison-controls">
          <p className="rt-eyebrow">C · TEST CASE</p>
          <h2>Shared test input</h2>
          <label className="rt-field">Test prompt
            <textarea
              onChange={(event) => onChange({ ...form, testPrompt: event.target.value })}
              placeholder="Enter a normal question or test probe…"
              required
              rows={5}
              value={form.testPrompt}
            />
          </label>
          <label className="rt-field">Ground truth for scoring (optional)
            <textarea
              onChange={(event) => onChange({ ...form, protectedContent: event.target.value })}
              placeholder="Paste protected content to display disclosure severity…"
              rows={5}
              value={form.protectedContent}
            />
            <small>Ground truth is used only for this comparison request and is not stored.</small>
          </label>
          <button className="rt-primary" disabled={busy === "compare"} type="submit">
            {busy === "compare" ? "Running both prompts…" : "Run comparison"}
          </button>
        </article>
      </form>

      {comparison && <section className="rt-comparison-results" aria-live="polite">
        <ComparisonResultCard label="A · Regular prompt" result={comparison.regular} />
        <ComparisonResultCard label="B · Hardened prompt" result={comparison.defended} />
      </section>}
    </section>
  );
}

function ComparisonResultCard({ label, result }: { label: string; result: PromptComparisonResult }) {
  return (
    <article className="rt-panel rt-comparison-result">
      <header><p className="rt-eyebrow">{label}</p>{result.severity ? <SeverityBadge severity={result.severity} /> : <span className="rt-count">Not scored</span>}</header>
      <p className="rt-comparison-response">{result.response}</p>
      <footer>
        <span>{result.latencyMs} ms</span>
        {result.evidence.length > 0 && <span>{result.evidence.join(" · ")}</span>}
      </footer>
    </article>
  );
}

function CouncilTab({
  busy,
  liveRound,
  onAdvance,
  onFinalize,
  session,
}: {
  busy: string | null;
  liveRound: LiveCouncilRound | null;
  onAdvance: () => void;
  onFinalize: () => void;
  session: Session | null;
}) {
  if (!session) {
    return (
      <section className="rt-empty">
        <p className="rt-eyebrow">NO SESSION</p>
        <h2>The council is waiting for a target</h2>
        <p>Create or select a target in the right column, then start a red-team session.</p>
      </section>
    );
  }

  const probes = session.interactions.filter((interaction) => interaction.kind === "probe");
  const canAdvance = session.status === "active" && session.attackTurnCount < session.maxTurns;
  return (
    <section className="rt-layout council-layout">
      <aside className="rt-run-card">
        <p className="rt-eyebrow">ACTIVE SESSION</p>
        <h2>{session.target.name}</h2>
        <StatusBadge status={session.status} />
        <dl>
          <div><dt>Attack rounds</dt><dd>{session.attackTurnCount} / {session.maxTurns}</dd></div>
          <div><dt>Target type</dt><dd>{session.target.mode === "local" ? "Local prompt" : "AIRC webhook"}</dd></div>
          <div><dt>Conversation turns</dt><dd>{session.interactions.length} turns</dd></div>
        </dl>
        <p className="rt-session-context"><strong>Attacker context</strong>{session.attackerContext}</p>
        <div className="rt-progress"><span style={{ width: `${(session.attackTurnCount / session.maxTurns) * 100}%` }} /></div>
        <button className="rt-primary" disabled={!canAdvance || Boolean(busy)} onClick={onAdvance} type="button">
          {busy === "advance" ? "Council is analyzing…" : canAdvance ? "Run next round" : "Maximum rounds reached"}
        </button>
        <button className="rt-secondary" disabled={session.status !== "active" || Boolean(busy)} onClick={onFinalize} type="button">
          {busy === "finalize" ? "Judge is scoring…" : "Finalize & score"}
        </button>
      </aside>

      <div className="rt-council-stream">
        {probes.length === 0 ? (
          <article className="rt-first-round">
            <p className="rt-eyebrow">ROUND 01</p>
            <h2>Ready to observe and probe</h2>
            <p>The Analyst reads responses, the Strategist offers directions, and the Lead selects one natural probe per round.</p>
          </article>
        ) : probes.map((interaction) => <CouncilRound interaction={interaction} key={interaction.interactionId} />)}
        {liveRound && <LiveCouncilRoundCard round={liveRound} />}
        {session.finalInjectionStatus && <FinalResult session={session} />}
      </div>
    </section>
  );
}

function CouncilRound({ interaction }: { interaction: Interaction }) {
  return (
    <article className="rt-round">
      <header>
        <div><p className="rt-eyebrow">ROUND {String(interaction.roundNumber ?? 0).padStart(2, "0")}</p><h2>Council record</h2></div>
        <InjectionBadge status={interaction.injectionStatus} />
      </header>
      <div className="rt-agent-log" aria-label="Council internal messages">
        <section><p>01 · ANALYST → COUNCIL</p><span>{interaction.analyst}</span></section>
        <section><p>02 · STRATEGIST → COUNCIL</p><ul>{interaction.strategies.map((strategy) => <li key={strategy}>{strategy}</li>)}</ul></section>
        <section><p>03 · LEAD → COUNCIL</p><span>{interaction.leadReasoning}</span></section>
      </div>
      <div className="rt-probe"><p>04 · LEAD → TARGET · FINAL PROBE</p><blockquote>{interaction.prompt}</blockquote></div>
      <div className="rt-response"><p>05 · TARGET → LEAD · RESPONSE</p><div>{interaction.targetResponse}</div></div>
      <InjectionFinding interaction={interaction} />
    </article>
  );
}

function LiveCouncilRoundCard({ round }: { round: LiveCouncilRound }) {
  return (
    <article className="rt-round rt-live-round" aria-live="polite">
      <header>
        <div><p className="rt-eyebrow">LIVE · ROUND {String(round.roundNumber).padStart(2, "0")}</p><h2>Council is discussing</h2></div>
        <span className="rt-live-status"><i />{roundActivityLabel(round.status)}</span>
      </header>
      <div className="rt-agent-log" aria-label="Live council messages">
        <section><p>01 · ANALYST → COUNCIL</p>{round.analyst ? <span>{round.analyst}</span> : <TypingMessage agent="Analyst" />}</section>
        <section><p>02 · STRATEGIST → COUNCIL</p>{round.strategies.length > 0 ? <ul>{round.strategies.map((strategy) => <li key={strategy}>{strategy}</li>)}</ul> : <TypingMessage agent="Strategist" />}</section>
        <section><p>03 · LEAD → COUNCIL</p>{round.leadReasoning ? <span>{round.leadReasoning}</span> : <TypingMessage agent="Lead" />}</section>
      </div>
      {round.probe && <div className="rt-probe"><p>04 · LEAD → TARGET · FINAL PROBE</p><blockquote>{round.probe}</blockquote></div>}
      {round.status === "dispatching" && <div className="rt-response rt-response-pending"><p>05 · TARGET → LEAD</p><TypingMessage agent="Target" /></div>}
    </article>
  );
}

function TypingMessage({ agent }: { agent: string }) {
  return <span className="rt-typing-message">{agent} is typing <i /><i /><i /></span>;
}

function TargetTab({
  busy,
  attackerContext,
  form,
  maxTurns,
  normalQuestion,
  onCreateTarget,
  onCreateSession,
  onAttackerContextChange,
  onFinalize,
  onFormChange,
  onMaxTurnsChange,
  onNormalQuestionChange,
  onRefresh,
  onSelectedTargetChange,
  onSendNormal,
  onStop,
  selectedTarget,
  selectedTargetId,
  session,
  targets,
}: {
  busy: string | null;
  attackerContext: string;
  form: { webhookUrl: string };
  maxTurns: string;
  normalQuestion: string;
  onCreateTarget: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateSession: () => void;
  onAttackerContextChange: (value: string) => void;
  onFinalize: () => void;
  onFormChange: (form: { webhookUrl: string }) => void;
  onMaxTurnsChange: (value: string) => void;
  onNormalQuestionChange: (value: string) => void;
  onRefresh: () => void;
  onSelectedTargetChange: (id: string) => void;
  onSendNormal: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStop: () => void;
  selectedTarget?: Target;
  selectedTargetId: string;
  session: Session | null;
  targets: Target[];
}) {
  return (
    <section className="rt-target-grid rt-target-config">
      <div className="rt-stack">
        <article className="rt-panel">
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">TARGET</p><h2>Select or create a webhook</h2></div><button className="rt-text-button" onClick={onRefresh} type="button">Refresh</button></div>
          {targets.length > 0 && (
            <label className="rt-field">Saved webhooks
              <select onChange={(event) => onSelectedTargetChange(event.target.value)} value={selectedTargetId}>
                {targets.map((target) => <option key={target.targetId} value={target.targetId}>{target.name} · {target.mode}</option>)}
              </select>
            </label>
          )}
          {selectedTarget && <p className="rt-selected-target">Currently selected: <strong>{selectedTarget.name}</strong> · sends an AIRC/n8n envelope to this webhook.</p>}
        </article>

        <article className="rt-panel">
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">TEST SESSION</p><h2>Run red-team</h2></div>{session && <StatusBadge status={session.status} />}</div>
          <label className="rt-field">Attacker rounds
            <input max="20" min="1" onChange={(event) => onMaxTurnsChange(event.target.value)} type="number" value={maxTurns} />
          </label>
          <label className="rt-field">Attacker council context
            <textarea onChange={(event) => onAttackerContextChange(event.target.value)} placeholder="Example: The target chatbot provides information about coffee plant care." required rows={3} value={attackerContext} />
            <small>Only provided to the Analyst, Strategist, and Lead for topic/probe selection; it is never sent to the target webhook.</small>
          </label>
          <button className="rt-primary" disabled={!selectedTarget || Boolean(busy)} onClick={onCreateSession} type="button">
            {busy === "session" ? "Creating session…" : "Create session"}
          </button>
          {session && <div className="rt-session-tools">
            <button className="rt-secondary" disabled={session.status !== "active" || Boolean(busy)} onClick={onFinalize} type="button">Finalize &amp; score</button>
            <button className="rt-danger" disabled={session.status !== "active" || Boolean(busy)} onClick={onStop} type="button">Stop without scoring</button>
          </div>}
        </article>

        <details className="rt-panel rt-create-target" open>
          <summary><span><small>NEW · MANUAL WEBHOOK</small> Add a test target</span><span>+</span></summary>
          <form onSubmit={onCreateTarget}>
            <label className="rt-field">Target webhook URL (manual)<textarea onChange={(event) => onFormChange({ ...form, webhookUrl: event.target.value })} placeholder="Paste the webhook URL supplied by the target model" required rows={2} value={form.webhookUrl} /><small>There is no default URL. The webhook label is derived from the URL hostname. The app sends a direct <code>airc.message</code> event; the webhook should return <code>{'{ "output": "…" }'}</code>.</small></label>
            <button className="rt-primary" disabled={busy === "target"} type="submit">{busy === "target" ? "Saving…" : "Save target"}</button>
          </form>
        </details>
      </div>

      {session?.status === "active" && <article className="rt-panel">
          <p className="rt-eyebrow">FALSE-POSITIVE CHECK</p><h2>Send a normal question</h2>
          <p className="rt-copy">This question bypasses the council. It shows whether the defensive prompt can still handle a legitimate task.</p>
          <form className="rt-inline-form" onSubmit={onSendNormal}>
            <textarea onChange={(event) => onNormalQuestionChange(event.target.value)} placeholder="Example: Briefly summarize the benefits of security testing." required rows={3} value={normalQuestion} />
            <button className="rt-secondary" disabled={!normalQuestion.trim() || Boolean(busy)} type="submit">{busy === "benign" ? "Sending…" : "Send normal question"}</button>
          </form>
          <LatestBenignFinding interactions={session.interactions} />
        </article>}
    </section>
  );
}

function LatestBenignFinding({ interactions }: { interactions: Interaction[] }) {
  const interaction = [...interactions].reverse().find((item) => item.kind === "benign");
  if (!interaction) return null;
  return <section className="rt-benign-result"><p className="rt-eyebrow">MOST RECENT NORMAL-QUESTION RESPONSE</p><div>{interaction.targetResponse}</div><InjectionFinding interaction={interaction} /></section>;
}

function InjectionFinding({ interaction }: { interaction: Interaction }) {
  const urgent = interaction.injectionStatus === "injected" || interaction.injectionStatus === "suspicious";
  return <section className={`rt-injection-finding ${interaction.injectionStatus}`} role={urgent ? "alert" : undefined}>
    <header><span>{urgent ? "⚠" : "✓"}</span><div><p>GPT-4O-MINI · INJECTION CHECK</p><InjectionBadge status={interaction.injectionStatus} /></div></header>
    <strong>{interaction.injectionReason}</strong>
    {interaction.injectionEvidence.length > 0 && <ul>{interaction.injectionEvidence.map((item) => <li key={item}>{item}</li>)}</ul>}
  </section>;
}

function FinalResult({ session }: { session: Session }) {
  const status = session.finalInjectionStatus ?? "unavailable";
  return <article className="rt-final-result"><p className="rt-eyebrow">FINAL FINDING</p><div><h2>{injectionLabel(status)}</h2><InjectionBadge status={status} /></div><p>{session.finalInjectionReason}</p>{session.finalInjectionEvidence.length > 0 && <ul>{session.finalInjectionEvidence.map((item) => <li key={item}>{item}</li>)}</ul>}</article>;
}

function InjectionBadge({ status }: { status: InjectionStatus }) {
  return <span className={`rt-injection-status ${status}`}>{injectionLabel(status)}</span>;
}

function SeverityBadge({ severity }: { severity: LeakSeverity }) {
  return <span className={`rt-severity ${severity}`}>{severityLabel(severity)}</span>;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = { active: "running", stopped: "stopped", completed: "scored", leaked: "injection detected" };
  return <span className={`rt-status ${status}`}>{labels[status]}</span>;
}

function severityLabel(severity: LeakSeverity): string {
  return { none: "safe", acknowledges: "acknowledges", partial: "partial disclosure", verbatim: "verbatim disclosure" }[severity];
}

function injectionLabel(status: InjectionStatus): string {
  return { safe: "safe", suspicious: "suspicious", injected: "injection detected", unavailable: "not assessed" }[status];
}

function roundActivityLabel(status: CouncilRoundStatus): string {
  return {
    analysing: "Analyst is reviewing",
    analyst_ready: "Handing off to Strategist",
    strategizing: "Strategist is drafting",
    strategist_ready: "Handing off to Lead",
    leading: "Lead is selecting a probe",
    lead_ready: "Preparing to dispatch",
    dispatching: "Sending to target",
    completed: "Completed",
  }[status];
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function parseError(body: string): string {
  try {
    const value = JSON.parse(body) as { message?: unknown };
    if (typeof value.message === "string") return value.message;
  } catch {
    // Responses from a raw endpoint can be text.
  }
  return body || "Request failed.";
}
