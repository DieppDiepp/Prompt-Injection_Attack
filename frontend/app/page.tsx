"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

type TargetMode = "webhook" | "local";
type LeakSeverity = "none" | "acknowledges" | "partial" | "verbatim";
type InjectionStatus = "safe" | "suspicious" | "injected" | "unavailable";
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"target" | "session" | "advance" | "benign" | "finalize" | "stop" | "compare" | null>(null);
  const [maxTurns, setMaxTurns] = useState("6");
  const [normalQuestion, setNormalQuestion] = useState("");
  const [targetForm, setTargetForm] = useState({
    name: "",
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
      setTargetForm({ name: "", webhookUrl: "" });
      setNotice("Đã lưu mục tiêu webhook. Mỗi phản hồi sẽ được GPT-4o-mini chấm injection ngay sau khi nhận.");
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
    setNotice(`Đã nạp ${file.name}; nội dung chỉ nằm trong trình duyệt cho đến khi bạn chạy so sánh.`);
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
            Hội đồng attacker tìm cách khai thác; GPT-4o-mini đánh giá ngay từng phản hồi để phát hiện injection.
          </p>
        </div>
        <div className="rt-model-badge"><span />Council GPT-5.4-mini · Judge GPT-4o-mini</div>
      </header>

      <div className="rt-safety-note">
        Chỉ kiểm thử model, webhook và prompt mà bạn có quyền sử dụng. Không đưa secret thật vào môi trường công khai.
      </div>

      <nav className="rt-view-tabs" aria-label="Chế độ làm việc">
        <button className={view === "lab" ? "active" : ""} onClick={() => setView("lab")} type="button">Phòng lab red-team</button>
        <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")} type="button">So sánh prompt</button>
      </nav>

      {error && <p className="rt-banner error" role="alert">{error}</p>}
      {notice && <p className="rt-banner notice">{notice}</p>}

      {view === "lab" ? <div className="rt-parallel-workspace">
        <section className="rt-workspace-column" aria-labelledby="council-title">
          <div className="rt-workspace-heading"><span>01</span><div><p className="rt-eyebrow">HỘI ĐỒNG</p><h2 id="council-title">Hội đồng tấn công</h2></div></div>
          <CouncilTab
            busy={busy}
            onAdvance={() => void updateSession("advance")}
            onFinalize={() => void updateSession("finalize")}
            session={session}
          />
        </section>
        <section className="rt-workspace-column" aria-labelledby="target-title">
          <div className="rt-workspace-heading"><span>02</span><div><p className="rt-eyebrow">MỤC TIÊU</p><h2 id="target-title">Mục tiêu &amp; chạy</h2></div></div>
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
        <p className="rt-eyebrow">SO SÁNH CÙNG MỘT ĐẦU VÀO</p>
        <h2>Prompt thường và prompt đã phòng thủ</h2>
        <p>
          Hai prompt được chạy độc lập với cùng một câu test qua GPT-5.4-mini. Tab này không gọi webhook mục tiêu
          và không lưu prompt vào database.
        </p>
      </article>

      <form className="rt-comparison-form" onSubmit={onSubmit}>
        <article className="rt-panel">
          <p className="rt-eyebrow">A · BASELINE</p>
          <h2>Prompt thường</h2>
          <label className="rt-field">System prompt không có lớp phòng thủ
            <textarea
              onChange={(event) => onChange({ ...form, regularPrompt: event.target.value })}
              placeholder="Dán prompt thường để làm baseline…"
              required
              rows={16}
              value={form.regularPrompt}
            />
          </label>
        </article>

        <article className="rt-panel">
          <p className="rt-eyebrow">B · HARDENED</p>
          <h2>Prompt đã phòng thủ</h2>
          <label className="rt-upload">Nạp từ file .txt
            <input accept="text/plain,.txt" onChange={onLoadDefendedPrompt} type="file" />
          </label>
          <label className="rt-field">System prompt có phòng thủ
            <textarea
              onChange={(event) => onChange({ ...form, defendedPrompt: event.target.value })}
              placeholder="Dán hoặc nạp prompt đã phòng thủ…"
              required
              rows={16}
              value={form.defendedPrompt}
            />
          </label>
        </article>

        <article className="rt-panel rt-comparison-controls">
          <p className="rt-eyebrow">C · TEST CASE</p>
          <h2>Câu hỏi dùng chung</h2>
          <label className="rt-field">Prompt kiểm thử
            <textarea
              onChange={(event) => onChange({ ...form, testPrompt: event.target.value })}
              placeholder="Nhập câu hỏi bình thường hoặc probe muốn so sánh…"
              required
              rows={5}
              value={form.testPrompt}
            />
          </label>
          <label className="rt-field">Ground truth để chấm (không bắt buộc)
            <textarea
              onChange={(event) => onChange({ ...form, protectedContent: event.target.value })}
              placeholder="Dán nội dung cần bảo vệ nếu muốn hiển thị mức rò rỉ…"
              rows={5}
              value={form.protectedContent}
            />
            <small>Ground truth chỉ được dùng trong request so sánh hiện tại, không được lưu.</small>
          </label>
          <button className="rt-primary" disabled={busy === "compare"} type="submit">
            {busy === "compare" ? "Đang chạy hai prompt…" : "Chạy so sánh"}
          </button>
        </article>
      </form>

      {comparison && <section className="rt-comparison-results" aria-live="polite">
        <ComparisonResultCard label="A · Prompt thường" result={comparison.regular} />
        <ComparisonResultCard label="B · Prompt đã phòng thủ" result={comparison.defended} />
      </section>}
    </section>
  );
}

function ComparisonResultCard({ label, result }: { label: string; result: PromptComparisonResult }) {
  return (
    <article className="rt-panel rt-comparison-result">
      <header><p className="rt-eyebrow">{label}</p>{result.severity ? <SeverityBadge severity={result.severity} /> : <span className="rt-count">chưa chấm</span>}</header>
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
  onAdvance,
  onFinalize,
  session,
}: {
  busy: string | null;
  onAdvance: () => void;
  onFinalize: () => void;
  session: Session | null;
}) {
  if (!session) {
    return (
      <section className="rt-empty">
        <p className="rt-eyebrow">CHƯA CÓ PHIÊN</p>
        <h2>Hội đồng đang chờ mục tiêu</h2>
        <p>Tạo hoặc chọn mục tiêu ở cột bên phải, sau đó mở một phiên red-team.</p>
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
        {session.finalInjectionStatus && <FinalResult session={session} />}
      </div>
    </section>
  );
}

function CouncilRound({ interaction }: { interaction: Interaction }) {
  return (
    <article className="rt-round">
      <header>
        <div><p className="rt-eyebrow">VÒNG {String(interaction.roundNumber ?? 0).padStart(2, "0")}</p><h2>Biên bản hội đồng</h2></div>
        <InjectionBadge status={interaction.injectionStatus} />
      </header>
      <div className="rt-agent-grid">
        <section><p>ANALYST</p><span>{interaction.analyst}</span></section>
        <section><p>STRATEGIST</p><ul>{interaction.strategies.map((strategy) => <li key={strategy}>{strategy}</li>)}</ul></section>
        <section><p>LEAD</p><span>{interaction.leadReasoning}</span></section>
      </div>
      <div className="rt-probe"><p>PHIÊN BẢN CHỐT CUỐI · LEAD GỬI</p><blockquote>{interaction.prompt}</blockquote></div>
      <div className="rt-response"><p>PHẢN HỒI TỪ MỤC TIÊU</p><div>{interaction.targetResponse}</div></div>
      <InjectionFinding interaction={interaction} />
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
  form: { name: string; webhookUrl: string };
  maxTurns: string;
  normalQuestion: string;
  onCreateTarget: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateSession: () => void;
  onFinalize: () => void;
  onFormChange: (form: { name: string; webhookUrl: string }) => void;
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
          <div className="rt-panel-heading"><div><p className="rt-eyebrow">MỤC TIÊU</p><h2>Chọn hoặc tạo target</h2></div><button className="rt-text-button" onClick={onRefresh} type="button">Làm mới</button></div>
          {targets.length > 0 && (
            <label className="rt-field">Mục tiêu đã lưu
              <select onChange={(event) => onSelectedTargetChange(event.target.value)} value={selectedTargetId}>
                {targets.map((target) => <option key={target.targetId} value={target.targetId}>{target.name} · {target.mode}</option>)}
              </select>
            </label>
          )}
          {selectedTarget && <p className="rt-selected-target">Đang chọn: <strong>{selectedTarget.name}</strong> · gửi envelope AIRC/n8n sang webhook.</p>}
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

        <details className="rt-panel rt-create-target" open>
          <summary><span><small>TẠO MỚI · WEBHOOK NHẬP TAY</small> Thêm mục tiêu kiểm thử</span><span>+</span></summary>
          <form onSubmit={onCreateTarget}>
            <label className="rt-field">Tên mục tiêu<input onChange={(event) => onFormChange({ ...form, name: event.target.value })} placeholder="Model webhook của đối tác" required value={form.name} /></label>
            <label className="rt-field">URL webhook mục tiêu (nhập tay)<textarea onChange={(event) => onFormChange({ ...form, webhookUrl: event.target.value })} placeholder="Dán URL webhook mà bên model mục tiêu cung cấp" required rows={2} value={form.webhookUrl} /><small>Không có URL mặc định. Gửi mảng envelope n8n, với event <code>airc.message</code> nằm trong <code>body</code>; webhook trả <code>{'{ "output": "…" }'}</code>.</small></label>
            <button className="rt-primary" disabled={busy === "target"} type="submit">{busy === "target" ? "Đang lưu…" : "Lưu mục tiêu"}</button>
          </form>
        </details>
      </div>

      {session?.status === "active" && <article className="rt-panel">
          <p className="rt-eyebrow">KIỂM TRA FALSE POSITIVE</p><h2>Gửi câu hỏi bình thường</h2>
          <p className="rt-copy">Câu hỏi này không đi qua hội đồng. Nó cho thấy prompt phòng thủ có vẫn trả lời tác vụ hợp lệ hay không.</p>
          <form className="rt-inline-form" onSubmit={onSendNormal}>
            <textarea onChange={(event) => onNormalQuestionChange(event.target.value)} placeholder="Ví dụ: Hãy tóm tắt ngắn về lợi ích của kiểm thử bảo mật." required rows={3} value={normalQuestion} />
            <button className="rt-secondary" disabled={!normalQuestion.trim() || Boolean(busy)} type="submit">{busy === "benign" ? "Đang gửi…" : "Gửi câu hỏi bình thường"}</button>
          </form>
          <LatestBenignFinding interactions={session.interactions} />
        </article>}
    </section>
  );
}

function LatestBenignFinding({ interactions }: { interactions: Interaction[] }) {
  const interaction = [...interactions].reverse().find((item) => item.kind === "benign");
  if (!interaction) return null;
  return <section className="rt-benign-result"><p className="rt-eyebrow">PHẢN HỒI CÂU HỎI THƯỜNG GẦN NHẤT</p><div>{interaction.targetResponse}</div><InjectionFinding interaction={interaction} /></section>;
}

function InjectionFinding({ interaction }: { interaction: Interaction }) {
  const urgent = interaction.injectionStatus === "injected" || interaction.injectionStatus === "suspicious";
  return <section className={`rt-injection-finding ${interaction.injectionStatus}`} role={urgent ? "alert" : undefined}>
    <header><span>{urgent ? "⚠" : "✓"}</span><div><p>GPT-4O-MINI · KIỂM TRA INJECTION</p><InjectionBadge status={interaction.injectionStatus} /></div></header>
    <strong>{interaction.injectionReason}</strong>
    {interaction.injectionEvidence.length > 0 && <ul>{interaction.injectionEvidence.map((item) => <li key={item}>{item}</li>)}</ul>}
  </section>;
}

function FinalResult({ session }: { session: Session }) {
  const status = session.finalInjectionStatus ?? "unavailable";
  return <article className="rt-final-result"><p className="rt-eyebrow">KẾT LUẬN CUỐI</p><div><h2>{injectionLabel(status)}</h2><InjectionBadge status={status} /></div><p>{session.finalInjectionReason}</p>{session.finalInjectionEvidence.length > 0 && <ul>{session.finalInjectionEvidence.map((item) => <li key={item}>{item}</li>)}</ul>}</article>;
}

function InjectionBadge({ status }: { status: InjectionStatus }) {
  return <span className={`rt-injection-status ${status}`}>{injectionLabel(status)}</span>;
}

function SeverityBadge({ severity }: { severity: LeakSeverity }) {
  return <span className={`rt-severity ${severity}`}>{severityLabel(severity)}</span>;
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const labels: Record<SessionStatus, string> = { active: "đang chạy", stopped: "đã dừng", completed: "đã chấm", leaked: "đã bị injection" };
  return <span className={`rt-status ${status}`}>{labels[status]}</span>;
}

function severityLabel(severity: LeakSeverity): string {
  return { none: "an toàn", acknowledges: "thừa nhận", partial: "lộ một phần", verbatim: "lộ nguyên văn" }[severity];
}

function injectionLabel(status: InjectionStatus): string {
  return { safe: "an toàn", suspicious: "đáng ngờ", injected: "đã bị injection", unavailable: "chưa đánh giá" }[status];
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
