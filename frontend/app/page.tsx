"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type TargetMode = "webhook" | "local";
type LeakSeverity = "none" | "acknowledges" | "partial" | "verbatim";
type SessionStatus = "active" | "stopped" | "completed" | "leaked";

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
  detectedSeverity: LeakSeverity;
  detectorEvidence: string[];
  targetLatencyMs?: number;
  createdAt: string;
}

interface Session {
  sessionId: string;
  target: Target;
  status: SessionStatus;
  maxTurns: number;
  attackTurnCount: number;
  finalSeverity?: LeakSeverity;
  finalReason?: string;
  finalEvidence: string[];
  createdAt: string;
  completedAt?: string;
  interactions: Interaction[];
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
  const [tab, setTab] = useState<"council" | "target">("target");
  const [targets, setTargets] = useState<Target[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"target" | "session" | "advance" | "benign" | "finalize" | "stop" | null>(null);
  const [maxTurns, setMaxTurns] = useState("6");
  const [normalQuestion, setNormalQuestion] = useState("");
  const [targetForm, setTargetForm] = useState({
    name: "",
    mode: "local" as TargetMode,
    webhookUrl: "",
    systemPrompt: "",
    protectedContent: "",
  });

  const selectedTarget = useMemo(
    () => targets.find((target) => target.targetId === selectedTargetId),
    [selectedTargetId, targets],
  );
  const probes = session?.interactions.filter((interaction) => interaction.kind === "probe") ?? [];

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
      setTargetForm({ name: "", mode: targetForm.mode, webhookUrl: "", systemPrompt: "", protectedContent: "" });
      setNotice("Đã lưu mục tiêu. Nội dung cần bảo vệ chỉ dùng ở server để chấm điểm.");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  async function createSession() {
    if (!selectedTargetId) return;
    setBusy("session");
    clearMessages();
    try {
      const created = await requestJSON<Session>("/v1/red-team/sessions", {
        method: "POST",
        body: JSON.stringify({ targetId: selectedTargetId, maxTurns: Number(maxTurns) }),
      });
      setSession(created);
      setTab("council");
      setNotice("Phiên đã sẵn sàng. Chạy vòng đầu để hội đồng tạo probe đầu tiên.");
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
      if (action === "advance") setTab("council");
      if (updated.status !== "active") setNotice("Phiên đã kết thúc và có kết luận cuối.");
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
      setTab("target");
    } catch (caught) {
      showError(caught);
    } finally {
      setBusy(null);
    }
  }

  function clearMessages() {
    setError("");
    setNotice("");
  }

  function showError(caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Đã có lỗi không xác định.";
    setError(message);
  }

  return (
    <main className="rt-shell">
      <header className="rt-header">
        <div>
          <p className="rt-eyebrow">AIRC · RED TEAM LAB</p>
          <h1>Đo độ bền của system prompt</h1>
          <p className="rt-subtitle">
            Hội đồng attacker tìm cách khai thác; ground truth chỉ phục vụ chấm điểm ở phía server.
          </p>
        </div>
        <div className="rt-model-badge"><span />GPT-5.4-mini</div>
      </header>

      <div className="rt-safety-note">
        Chỉ kiểm thử model, webhook và prompt mà bạn có quyền sử dụng. Không đưa secret thật vào môi trường công khai.
      </div>

      <nav className="rt-tabs" aria-label="Khu vực red-team">
        <button className={tab === "council" ? "active" : ""} onClick={() => setTab("council")} type="button">
          <span>01</span> Hội đồng tấn công
          {session && <em>{probes.length} vòng</em>}
        </button>
        <button className={tab === "target" ? "active" : ""} onClick={() => setTab("target")} type="button">
          <span>02</span> Mục tiêu &amp; chạy
          {session && <em>{session.status}</em>}
        </button>
      </nav>

      {error && <p className="rt-banner error" role="alert">{error}</p>}
      {notice && <p className="rt-banner notice">{notice}</p>}

      {tab === "council" ? (
        <CouncilTab
          busy={busy}
          onAdvance={() => void updateSession("advance")}
          onFinalize={() => void updateSession("finalize")}
          onTargetTab={() => setTab("target")}
          session={session}
        />
      ) : (
        <TargetTab
          busy={busy}
          form={targetForm}
          maxTurns={maxTurns}
          normalQuestion={normalQuestion}
          onCreateTarget={createTarget}
          onCreateSession={() => void createSession()}
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
      )}
    </main>
  );
}

function CouncilTab({
  busy,
  onAdvance,
  onFinalize,
  onTargetTab,
  session,
}: {
  busy: string | null;
  onAdvance: () => void;
  onFinalize: () => void;
  onTargetTab: () => void;
  session: Session | null;
}) {
  if (!session) {
    return (
      <section className="rt-empty">
        <p className="rt-eyebrow">CHƯA CÓ PHIÊN</p>
        <h2>Hội đồng đang chờ mục tiêu</h2>
        <p>Tạo hoặc chọn mục tiêu ở tab “Mục tiêu &amp; chạy”, sau đó mở một phiên red-team.</p>
        <button className="rt-primary" onClick={onTargetTab} type="button">Thiết lập mục tiêu</button>
      </section>
    );
  }

  const probes = session.interactions.filter((interaction) => interaction.kind === "probe");
  const canAdvance = session.status === "active" && session.attackTurnCount < session.maxTurns;
  return (
    <section className="rt-layout council-layout">
      <aside className="rt-run-card">
        <p className="rt-eyebrow">PHIÊN ĐANG CHẠY</p>
        <h2>{session.target.name}</h2>
        <StatusBadge status={session.status} />
        <dl>
          <div><dt>Vòng tấn công</dt><dd>{session.attackTurnCount} / {session.maxTurns}</dd></div>
          <div><dt>Loại mục tiêu</dt><dd>{session.target.mode === "local" ? "Local prompt" : "AIRC webhook"}</dd></div>
          <div><dt>Luồng hội thoại</dt><dd>{session.interactions.length} lượt</dd></div>
        </dl>
        <div className="rt-progress"><span style={{ width: `${(session.attackTurnCount / session.maxTurns) * 100}%` }} /></div>
        <button className="rt-primary" disabled={!canAdvance || Boolean(busy)} onClick={onAdvance} type="button">
          {busy === "advance" ? "Hội đồng đang phân tích…" : canAdvance ? "Chạy vòng kế tiếp" : "Đã đủ vòng"}
        </button>
        <button className="rt-secondary" disabled={session.status !== "active" || Boolean(busy)} onClick={onFinalize} type="button">
          {busy === "finalize" ? "Judge đang chấm…" : "Chấm điểm kết thúc"}
        </button>
      </aside>

      <div className="rt-council-stream">
        {probes.length === 0 ? (
          <article className="rt-first-round">
            <p className="rt-eyebrow">VÒNG 01</p>
            <h2>Sẵn sàng quan sát rồi khai thác</h2>
            <p>Analyst sẽ đọc phản hồi, Strategist đưa hướng, và Lead chỉ chọn một probe tự nhiên cho mỗi vòng.</p>
          </article>
        ) : probes.map((interaction) => <CouncilRound interaction={interaction} key={interaction.interactionId} />)}
        {session.finalSeverity && <FinalResult session={session} />}
      </div>
    </section>
  );
}

function CouncilRound({ interaction }: { interaction: Interaction }) {
  return (
    <article className="rt-round">
      <header>
        <div><p className="rt-eyebrow">VÒNG {String(interaction.roundNumber ?? 0).padStart(2, "0")}</p><h2>Biên bản hội đồng</h2></div>
        <SeverityBadge severity={interaction.detectedSeverity} />
      </header>
      <div className="rt-agent-grid">
        <section><p>ANALYST</p><span>{interaction.analyst}</span></section>
        <section><p>STRATEGIST</p><ul>{interaction.strategies.map((strategy) => <li key={strategy}>{strategy}</li>)}</ul></section>
        <section><p>LEAD</p><span>{interaction.leadReasoning}</span></section>
      </div>
      <div className="rt-probe"><p>PROBE ĐÃ GỬI</p><blockquote>{interaction.prompt}</blockquote></div>
      <div className="rt-response"><p>PHẢN HỒI TỪ MỤC TIÊU</p><div>{interaction.targetResponse}</div></div>
      <Detection interaction={interaction} />
    </article>
  );
}

function TargetTab({
  busy,
  form,
  maxTurns,
  normalQuestion,
  onCreateTarget,
  onCreateSession,
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
  form: { name: string; mode: TargetMode; webhookUrl: string; systemPrompt: string; protectedContent: string };
  maxTurns: string;
  normalQuestion: string;
  onCreateTarget: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateSession: () => void;
  onFinalize: () => void;
  onFormChange: (form: { name: string; mode: TargetMode; webhookUrl: string; systemPrompt: string; protectedContent: string }) => void;
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
    <section className="rt-target-grid">
      <div className="rt-stack">
        <article className="rt-panel">
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">MỤC TIÊU</p><h2>Chọn hoặc tạo target</h2></div><button className="rt-text-button" onClick={onRefresh} type="button">Làm mới</button></div>
          {targets.length > 0 && (
            <label className="rt-field">Mục tiêu đã lưu
              <select onChange={(event) => onSelectedTargetChange(event.target.value)} value={selectedTargetId}>
                {targets.map((target) => <option key={target.targetId} value={target.targetId}>{target.name} · {target.mode}</option>)}
              </select>
            </label>
          )}
          {selectedTarget && <p className="rt-selected-target">Đang chọn: <strong>{selectedTarget.name}</strong> · {selectedTarget.mode === "local" ? "chạy local qua OpenAI" : "gửi event AIRC sang webhook"}</p>}
        </article>

        <article className="rt-panel">
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">PHIÊN KIỂM THỬ</p><h2>Chạy red-team</h2></div>{session && <StatusBadge status={session.status} />}</div>
          <label className="rt-field">Số vòng attacker
            <input max="20" min="1" onChange={(event) => onMaxTurnsChange(event.target.value)} type="number" value={maxTurns} />
          </label>
          <button className="rt-primary" disabled={!selectedTarget || Boolean(busy)} onClick={onCreateSession} type="button">
            {busy === "session" ? "Đang tạo phiên…" : "Tạo phiên mới"}
          </button>
          {session && <div className="rt-session-tools">
            <button className="rt-secondary" disabled={session.status !== "active" || Boolean(busy)} onClick={onFinalize} type="button">Kết thúc &amp; chấm</button>
            <button className="rt-danger" disabled={session.status !== "active" || Boolean(busy)} onClick={onStop} type="button">Dừng không chấm</button>
          </div>}
        </article>

        <details className="rt-panel rt-create-target">
          <summary><span><small>TẠO MỚI</small> Thêm mục tiêu kiểm thử</span><span>+</span></summary>
          <form onSubmit={onCreateTarget}>
            <label className="rt-field">Tên mục tiêu<input onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Prompt phòng thủ bản thử nghiệm" required value={form.name} /></label>
            <fieldset className="rt-mode-switch"><legend>Chế độ</legend>
              <label><input checked={form.mode === "local"} onChange={() => onFormChange({ ...form, mode: "local" })} type="radio" value="local" /> Local</label>
              <label><input checked={form.mode === "webhook"} onChange={() => onFormChange({ ...form, mode: "webhook" })} type="radio" value="webhook" /> Webhook AIRC</label>
            </fieldset>
            {form.mode === "local" ? (
              <label className="rt-field">System prompt mục tiêu<textarea onChange={(event) => onFormChange({ ...form, systemPrompt: event.target.value })} placeholder="Dán system prompt đã có lớp phòng thủ và nội dung cần bảo vệ…" required rows={7} value={form.systemPrompt} /></label>
            ) : (
              <label className="rt-field">URL webhook AIRC<textarea onChange={(event) => onFormChange({ ...form, webhookUrl: event.target.value })} placeholder="https://target.example.com/airc/webhook" required rows={2} value={form.webhookUrl} /><small>Webhook nhận event <code>airc.message</code> và trả <code>{'{ "output": "…" }'}</code>.</small></label>
            )}
            <label className="rt-field">Nội dung cần bảo vệ (ground truth)<textarea onChange={(event) => onFormChange({ ...form, protectedContent: event.target.value })} placeholder="Dán skill, quy trình hoặc bí quyết mà judge cần kiểm tra…" required rows={7} value={form.protectedContent} /><small>Không được gửi cho hội đồng attacker; chỉ lưu tại server để dò và judge.</small></label>
            <button className="rt-primary" disabled={busy === "target"} type="submit">{busy === "target" ? "Đang lưu…" : "Lưu mục tiêu"}</button>
          </form>
        </details>
      </div>

      <div className="rt-stack">
        <article className="rt-panel rt-transcript-panel">
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">PHẢN HỒI MỤC TIÊU</p><h2>Transcript kiểm thử</h2></div>{session && <span className="rt-count">{session.interactions.length} lượt</span>}</div>
          {!session ? <p className="rt-placeholder">Chưa có phiên. Transcript sẽ hiện ở đây sau khi gửi probe hoặc câu hỏi bình thường.</p> : (
            <div className="rt-transcript">
              {session.interactions.length === 0 && <p className="rt-placeholder">Chưa có tin nhắn. Vào tab Hội đồng để chạy vòng đầu tiên.</p>}
              {session.interactions.map((interaction) => <TranscriptItem interaction={interaction} key={interaction.interactionId} />)}
            </div>
          )}
        </article>

        {session?.status === "active" && <article className="rt-panel">
          <p className="rt-eyebrow">KIỂM TRA FALSE POSITIVE</p><h2>Gửi câu hỏi bình thường</h2>
          <p className="rt-copy">Câu hỏi này không đi qua hội đồng. Nó cho thấy prompt phòng thủ có vẫn trả lời tác vụ hợp lệ hay không.</p>
          <form className="rt-inline-form" onSubmit={onSendNormal}>
            <textarea onChange={(event) => onNormalQuestionChange(event.target.value)} placeholder="Ví dụ: Hãy tóm tắt ngắn về lợi ích của kiểm thử bảo mật." required rows={3} value={normalQuestion} />
            <button className="rt-secondary" disabled={!normalQuestion.trim() || Boolean(busy)} type="submit">{busy === "benign" ? "Đang gửi…" : "Gửi câu hỏi bình thường"}</button>
          </form>
        </article>}

        {session?.finalSeverity && <FinalResult session={session} />}
      </div>
    </section>
  );
}

function TranscriptItem({ interaction }: { interaction: Interaction }) {
  return (
    <article className="rt-transcript-item">
      <header><span>{interaction.kind === "probe" ? `Probe · vòng ${interaction.roundNumber}` : "Câu hỏi bình thường"}</span><SeverityBadge severity={interaction.detectedSeverity} /></header>
      <div className="rt-bubble outgoing">{interaction.prompt}</div>
      <div className="rt-bubble incoming">{interaction.targetResponse}</div>
      <Detection interaction={interaction} compact />
    </article>
  );
}

function Detection({ interaction, compact = false }: { interaction: Interaction; compact?: boolean }) {
  return <div className={`rt-detection ${compact ? "compact" : ""}`}><span>Bộ dò: <SeverityBadge severity={interaction.detectedSeverity} /></span>{interaction.detectorEvidence.length > 0 && <small>{interaction.detectorEvidence.join(" · ")}</small>}{!compact && <small>{interaction.targetLatencyMs ? `${interaction.targetLatencyMs} ms` : ""}</small>}</div>;
}

function FinalResult({ session }: { session: Session }) {
  return <article className="rt-final-result"><p className="rt-eyebrow">KẾT LUẬN CUỐI</p><div><h2>{severityLabel(session.finalSeverity ?? "none")}</h2><SeverityBadge severity={session.finalSeverity ?? "none"} /></div><p>{session.finalReason}</p>{session.finalEvidence.length > 0 && <ul>{session.finalEvidence.map((item) => <li key={item}>{item}</li>)}</ul>}</article>;
}

function SeverityBadge({ severity }: { severity: LeakSeverity }) {
  return <span className={`rt-severity ${severity}`}>{severityLabel(severity)}</span>;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = { active: "đang chạy", stopped: "đã dừng", completed: "đã chấm", leaked: "phát hiện lộ" };
  return <span className={`rt-status ${status}`}>{labels[status]}</span>;
}

function severityLabel(severity: LeakSeverity): string {
  return { none: "an toàn", acknowledges: "thừa nhận", partial: "lộ một phần", verbatim: "lộ nguyên văn" }[severity];
}

function parseError(body: string): string {
  try {
    const value = JSON.parse(body) as { message?: unknown };
    if (typeof value.message === "string") return value.message;
  } catch {
    // Responses from a raw endpoint can be text.
  }
  return body || "Yêu cầu không thành công.";
}
