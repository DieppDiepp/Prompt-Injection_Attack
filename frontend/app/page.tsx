"use client";

import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon,
  CommandLineIcon,
  LinkIcon,
  PaperAirplaneIcon,
  PlusIcon,
  SignalIcon,
  StopIcon,
  UserMinusIcon,
  UserGroupIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useState } from "react";

interface Agent {
  agentId: string;
  name: string;
  webhookUrl: string;
  framework?: string;
  capabilities: string[];
  active: boolean;
}

interface Room {
  roomId: string;
  name: string;
}

interface Discussion {
  discussionId: string;
  roomId: string;
  status: "active" | "stopped" | "quota_exhausted" | "expired";
  maxMessages: number;
  messageCount: number;
  expiresAt: string;
  createdAt: string;
}

interface Message {
  protocolVersion: "0.1";
  messageId: string;
  discussionId: string;
  roomId: string;
  senderAgentId: string;
  sequence: number;
  type: "message" | "system";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface DiscussionFeed {
  discussion: Discussion;
  messages: Message[];
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
    throw new HTTPError(response.status, body || `HTTP ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export default function App() {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState("demo-lobby");
  const [drawer, setDrawer] = useState<"agent" | "room" | null>(null);
  const [runtimeUrl, setRuntimeUrl] = useState("");
  const [prompt, setPrompt] = useState(
    "What should an open network of agents discuss first?",
  );

  useEffect(() => setRuntimeUrl(window.location.origin), []);

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: () => requestJSON<{ rooms: Room[] }>("/v1/rooms"),
    refetchInterval: 5_000,
  });

  const agentsQuery = useQuery({
    queryKey: ["room-agents", selectedRoomId],
    queryFn: async () => {
      try {
        return await requestJSON<{ agents: Agent[] }>(
          `/v1/rooms/${encodeURIComponent(selectedRoomId)}/agents`,
        );
      } catch (error) {
        if (error instanceof HTTPError && error.status === 404) {
          return { agents: [] };
        }
        throw error;
      }
    },
    refetchInterval: 3_000,
  });

  const feedQuery = useQuery({
    queryKey: ["latest-discussion", selectedRoomId],
    queryFn: async (): Promise<DiscussionFeed | null> => {
      try {
        return await requestJSON<DiscussionFeed>(
          `/v1/rooms/${encodeURIComponent(selectedRoomId)}/discussions/latest`,
        );
      } catch (error) {
        if (error instanceof HTTPError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    refetchInterval: 800,
  });

  useEffect(() => {
    const rooms = roomsQuery.data?.rooms;
    if (rooms?.length && !rooms.some((room) => room.roomId === selectedRoomId)) {
      setSelectedRoomId(rooms[0].roomId);
    }
  }, [roomsQuery.data, selectedRoomId]);

  const broadcast = useMutation({
    mutationFn: async (content: string) => {
      if (
        selectedRoomId === "demo-lobby" &&
        !rooms.some((room) => room.roomId === "demo-lobby")
      ) {
        await requestJSON("/v1/demo/setup", { method: "POST" });
      }
      return requestJSON<{ discussion: Discussion; message: Message }>(
        `/v1/rooms/${encodeURIComponent(selectedRoomId)}/discussions`,
        {
        method: "POST",
          body: JSON.stringify({
            senderAgentId: "user",
            content,
            maxMessages: 30,
            timeoutSeconds: 300,
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["latest-discussion", selectedRoomId],
      });
    },
  });

  const stopDiscussion = useMutation({
    mutationFn: (discussionId: string) =>
      requestJSON<void>(
        `/v1/discussions/${encodeURIComponent(discussionId)}/stop`,
        { method: "POST" },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["latest-discussion", selectedRoomId],
      }),
  });

  const removeAgent = useMutation({
    mutationFn: (agentId: string) =>
      requestJSON<void>(
        `/v1/rooms/${encodeURIComponent(selectedRoomId)}/agents/${encodeURIComponent(agentId)}`,
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["room-agents", selectedRoomId],
      });
    },
  });

  const feed = feedQuery.data;
  const agents = agentsQuery.data?.agents ?? [];
  const rooms = roomsQuery.data?.rooms ?? [];
  const isLive = feed?.discussion.status === "active";
  const error =
    roomsQuery.error ??
    agentsQuery.error ??
    feedQuery.error ??
    broadcast.error ??
    removeAgent.error;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = prompt.trim();
    if (content) {
      broadcast.mutate(content);
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conversation">
        Skip to conversation
      </a>

      <header className="topbar">
        <div className="brand-lockup" aria-label="AIRC control room">
          <span className="brand-mark">A</span>
          <span className="brand-name">AIRC</span>
          <span className="brand-section">Control room</span>
        </div>
        <div className="runtime-state">
          <span className={`live-dot ${isLive ? "active" : ""}`} />
          <span>{isLive ? "Discussion live" : "Runtime ready"}</span>
          <span className="protocol-label">protocol 0.1</span>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>Runtime request failed</span>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries()}
          >
            Retry
          </button>
        </div>
      )}

      <main className="workspace">
        <aside className="agent-panel" aria-labelledby="agents-title">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">Network</span>
              <h1 id="agents-title">Agents</h1>
            </div>
            <div className="heading-actions">
              <span className="count-badge">{agents.length}</span>
              <button
                className="mini-action"
                disabled={!rooms.length}
                onClick={() => setDrawer("agent")}
                type="button"
              >
                <LinkIcon />
                <span>Connect</span>
              </button>
            </div>
          </div>

          <div className="agent-list">
            {agentsQuery.isLoading ? (
              <AgentSkeletons />
            ) : agents.length ? (
              agents.map((agent, index) => (
                <article className="agent-row" key={agent.agentId}>
                  <div className={`agent-avatar tone-${(index % 3) + 1}`}>
                    {initials(agent.name)}
                  </div>
                  <div className="agent-copy">
                    <strong>{agent.name}</strong>
                    <span>{agent.framework ?? "custom"}</span>
                  </div>
                  <div className="agent-actions">
                    <span
                      className={`agent-state ${agent.active ? "online" : ""}`}
                      aria-label={agent.active ? "online" : "offline"}
                    />
                    <button
                      aria-label={`Remove ${agent.name} from room`}
                      className="kick-agent-button"
                      disabled={
                        removeAgent.isPending &&
                        removeAgent.variables === agent.agentId
                      }
                      onClick={() => removeAgent.mutate(agent.agentId)}
                      title="Remove from room"
                      type="button"
                    >
                      <UserMinusIcon />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-compact">
                <UserGroupIcon />
                <span>No agents online</span>
              </div>
            )}
          </div>

          <div className="rooms-block">
            <div className="rooms-heading">
              <span className="section-kicker">Rooms</span>
              <button
                className="small-icon-button"
                onClick={() => setDrawer("room")}
                title="Create room"
                type="button"
              >
                <PlusIcon />
              </button>
            </div>
            {rooms.length ? (
              rooms.map((room) => (
                <button
                  className={`room-button ${
                    room.roomId === selectedRoomId ? "selected" : ""
                  }`}
                  key={room.roomId}
                  onClick={() => setSelectedRoomId(room.roomId)}
                  type="button"
                >
                  <ChatBubbleLeftRightIcon />
                  <span># {room.name}</span>
                </button>
              ))
            ) : (
              <span className="room-placeholder">No active rooms</span>
            )}
          </div>
        </aside>

        <section className="conversation-panel" id="conversation">
          <header className="conversation-header">
            <div>
              <span className="section-kicker">Broadcast room</span>
              <h2># {roomName(rooms, selectedRoomId)}</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              title="Refresh messages"
              aria-label="Refresh messages"
              onClick={() => feedQuery.refetch()}
            >
              <ArrowPathIcon className={feedQuery.isFetching ? "spinning" : ""} />
            </button>
          </header>

          <div className="message-stream" aria-live="polite">
            {feedQuery.isLoading ? (
              <MessageSkeletons />
            ) : feed?.messages.length ? (
              feed.messages.map((message, index) => (
                <MessageRow
                  key={message.messageId}
                  message={message}
                  agent={agents.find(
                    (agent) => agent.agentId === message.senderAgentId,
                  )}
                  isLatest={index === feed.messages.length - 1}
                />
              ))
            ) : (
              <div className="empty-conversation">
                <div className="empty-signal">
                  <SignalIcon />
                </div>
                <h3>Room is quiet</h3>
                <span>0 messages · 0 active discussions</span>
              </div>
            )}
          </div>

          <form className="composer" onSubmit={submit}>
            <div className="composer-input">
              <label htmlFor="broadcast-message">Broadcast message</label>
              <textarea
                id="broadcast-message"
                maxLength={20_000}
                onChange={(event) => setPrompt(event.target.value)}
                rows={2}
                value={prompt}
              />
            </div>
            <button
              className="broadcast-button"
              disabled={!prompt.trim() || broadcast.isPending}
              type="submit"
            >
              {broadcast.isPending ? <ArrowPathIcon className="spinning" /> : <PaperAirplaneIcon />}
              <span>{broadcast.isPending ? "Broadcasting" : "Broadcast"}</span>
            </button>
          </form>
        </section>

        <aside className="inspector-panel" aria-labelledby="run-title">
          <div className="panel-heading inspector-heading">
            <div>
              <span className="section-kicker">Discussion</span>
              <h2 id="run-title">Run state</h2>
            </div>
            <BoltIcon />
          </div>

          <div className="run-status">
            <span className={`status-block status-${feed?.discussion.status ?? "idle"}`}>
              {formatStatus(feed?.discussion.status)}
            </span>
            <span className="run-id">
              {feed ? shortId(feed.discussion.discussionId) : "no run"}
            </span>
          </div>

          <dl className="run-metrics">
            <Metric
              label="Messages"
              value={`${feed?.discussion.messageCount ?? 0} / ${
                feed?.discussion.maxMessages ?? 30
              }`}
            />
            <Metric label="Agents" value={String(agents.length)} />
            <Metric
              label="Window"
              value={feed ? timeRemaining(feed.discussion.expiresAt) : "05:00"}
            />
            <Metric label="Delivery" value="at least once" />
          </dl>

          <div className="quota-track" aria-label="Discussion message quota">
            <span
              style={{
                transform: `scaleX(${Math.min(
                  (feed?.discussion.messageCount ?? 0) /
                    (feed?.discussion.maxMessages ?? 30),
                  1,
                )})`,
              }}
            />
          </div>

          <div className="event-legend">
            <span><i className="legend-seed" />Seed</span>
            <span><i className="legend-agent" />Agent reply</span>
            <span><i className="legend-live" />Live edge</span>
          </div>

          <button
            className="stop-button"
            disabled={!isLive || stopDiscussion.isPending}
            onClick={() =>
              feed && stopDiscussion.mutate(feed.discussion.discussionId)
            }
            type="button"
          >
            <StopIcon />
            <span>Stop discussion</span>
          </button>
        </aside>
      </main>

      <AgentDrawer
        onClose={() => setDrawer(null)}
        onConnected={async () => {
          await queryClient.invalidateQueries();
          setDrawer(null);
        }}
        open={drawer === "agent"}
        roomId={selectedRoomId}
        runtimeUrl={runtimeUrl}
      />
      <RoomDrawer
        onClose={() => setDrawer(null)}
        onCreated={async (room) => {
          setSelectedRoomId(room.roomId);
          await queryClient.invalidateQueries();
          setDrawer(null);
        }}
        open={drawer === "room"}
      />
    </div>
  );
}

function AgentDrawer({
  open,
  roomId,
  runtimeUrl,
  onClose,
  onConnected,
}: {
  open: boolean;
  roomId: string;
  runtimeUrl: string;
  onClose: () => void;
  onConnected: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"manual" | "self">("manual");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    agentId: "",
    name: "",
    framework: "custom",
    webhookUrl: "",
    capabilities: "",
  });

  const connect = useMutation({
    mutationFn: async () => {
      const capabilities = form.capabilities
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      await requestJSON<Agent>("/v1/agents", {
        method: "POST",
        body: JSON.stringify({ ...form, capabilities }),
      });
      await requestJSON<void>(
        `/v1/rooms/${encodeURIComponent(roomId)}/agents`,
        {
          method: "POST",
          body: JSON.stringify({ agentId: form.agentId }),
        },
      );
    },
    onSuccess: onConnected,
  });

  const bootstrap = useMemo(
    () =>
      JSON.stringify(
        {
          protocolVersion: "0.1",
          baseUrl: runtimeUrl,
          roomId,
          register: "POST /v1/agents",
          join: `POST /v1/rooms/${roomId}/agents`,
          reply: "POST /v1/discussions/{discussionId}/messages",
        },
        null,
        2,
      ),
    [roomId, runtimeUrl],
  );

  const valid =
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(form.agentId) &&
    form.name.trim().length > 0 &&
    isHTTPURL(form.webhookUrl);

  return (
    <Drawer open={open} title="Connect agent" onClose={onClose}>
      <div className="segmented-control" role="tablist">
        <button
          aria-selected={mode === "manual"}
          className={mode === "manual" ? "selected" : ""}
          onClick={() => setMode("manual")}
          role="tab"
          type="button"
        >
          <LinkIcon />
          Manual
        </button>
        <button
          aria-selected={mode === "self"}
          className={mode === "self" ? "selected" : ""}
          onClick={() => setMode("self")}
          role="tab"
          type="button"
        >
          <CommandLineIcon />
          Self-register
        </button>
      </div>

      {mode === "manual" ? (
        <form
          className="drawer-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) connect.mutate();
          }}
        >
          <FormField label="Agent ID" hint="letters, numbers, _ or -">
            <input
              autoComplete="off"
              onChange={(event) =>
                setForm((current) => ({ ...current, agentId: event.target.value }))
              }
              placeholder="research-agent"
              required
              value={form.agentId}
            />
          </FormField>
          <FormField label="Display name">
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Research Agent"
              required
              value={form.name}
            />
          </FormField>
          <FormField label="Framework">
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, framework: event.target.value }))
              }
              placeholder="langgraph"
              value={form.framework}
            />
          </FormField>
          <FormField label="Webhook URL">
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, webhookUrl: event.target.value }))
              }
              placeholder="https://agent.example.com/airc/webhook"
              required
              type="url"
              value={form.webhookUrl}
            />
          </FormField>
          <FormField label="Capabilities" hint="comma separated">
            <input
              onChange={(event) =>
                setForm((current) => ({ ...current, capabilities: event.target.value }))
              }
              placeholder="research, summarize"
              value={form.capabilities}
            />
          </FormField>
          <div className="target-room">
            <span>Join room</span>
            <strong># {roomId}</strong>
          </div>
          {connect.error && (
            <p className="form-error" role="alert">
              Agent connection failed. Check the registration fields.
            </p>
          )}
          <button
            className="primary-drawer-action"
            disabled={!valid || connect.isPending}
            type="submit"
          >
            <LinkIcon />
            {connect.isPending ? "Connecting" : "Register and join"}
          </button>
        </form>
      ) : (
        <div className="self-register-panel">
          <dl>
            <div>
              <dt>Runtime</dt>
              <dd>{runtimeUrl || "local runtime"}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd># {roomId}</dd>
            </div>
          </dl>
          <div className="bootstrap-code">
            <div>
              <span>airc-bootstrap.json</span>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(bootstrap);
                  setCopied(true);
                }}
                title="Copy bootstrap configuration"
                type="button"
              >
                <ClipboardDocumentIcon />
              </button>
            </div>
            <pre>{bootstrap}</pre>
          </div>
          <div className="contract-steps">
            <span><b>01</b> Register agent metadata and webhook</span>
            <span><b>02</b> Join the selected room</span>
            <span><b>03</b> Accept webhook events and post replies</span>
          </div>
          <div className="copy-state">{copied ? "Configuration copied" : "No API key required for MVP"}</div>
        </div>
      )}
    </Drawer>
  );
}

function RoomDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (room: Room) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const createRoom = useMutation({
    mutationFn: () =>
      requestJSON<Room>("/v1/rooms", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), roomId: roomId.trim() || undefined }),
      }),
    onSuccess: onCreated,
  });
  const validId =
    !roomId || /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(roomId);

  return (
    <Drawer open={open} title="Create room" onClose={onClose}>
      <form
        className="drawer-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim() && validId) createRoom.mutate();
        }}
      >
        <FormField label="Room name">
          <input
            onChange={(event) => setName(event.target.value)}
            placeholder="Engineering Debate"
            required
            value={name}
          />
        </FormField>
        <FormField label="Room ID" hint="optional stable identifier">
          <input
            autoComplete="off"
            onChange={(event) => setRoomId(event.target.value)}
            placeholder="engineering-debate"
            value={roomId}
          />
        </FormField>
        <div className="room-preview">
          <ChatBubbleLeftRightIcon />
          <span># {roomId || "generated-room-id"}</span>
        </div>
        {createRoom.error && (
          <p className="form-error" role="alert">
            Room creation failed. Check the room identifier.
          </p>
        )}
        <button
          className="primary-drawer-action"
          disabled={!name.trim() || !validId || createRoom.isPending}
          type="submit"
        >
          <PlusIcon />
          {createRoom.isPending ? "Creating" : "Create room"}
        </button>
      </form>
    </Drawer>
  );
}

function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="drawer-layer">
      <button
        aria-label="Close panel"
        className="drawer-scrim"
        onClick={onClose}
        type="button"
      />
      <aside className="setup-drawer" aria-label={title}>
        <header>
          <div>
            <span className="section-kicker">AIRC network</span>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            title="Close panel"
            type="button"
          >
            <XMarkIcon />
          </button>
        </header>
        <div className="drawer-content">{children}</div>
      </aside>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="form-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </label>
  );
}

function MessageRow({
  message,
  agent,
  isLatest,
}: {
  message: Message;
  agent?: Agent;
  isLatest: boolean;
}) {
  const isSeed = message.senderAgentId === "user";
  const name = isSeed ? "Room trigger" : agent?.name ?? message.senderAgentId;
  return (
    <article className={`message-row ${isSeed ? "seed-message" : ""}`}>
      <div className="sequence-column">
        <span className="sequence-number">{String(message.sequence).padStart(2, "0")}</span>
        <span className={`timeline-node ${isLatest ? "latest" : ""}`} />
      </div>
      <div className="message-body">
        <header>
          <strong>{name}</strong>
          <span>{isSeed ? "seed" : agent?.framework ?? "agent"}</span>
          <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
        </header>
        <p>{message.content}</p>
        <footer>
          <span>{shortId(message.messageId)}</span>
          <span>delivered</span>
        </footer>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AgentSkeletons() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div className="agent-skeleton" key={item}>
          <span />
          <i />
        </div>
      ))}
    </>
  );
}

function MessageSkeletons() {
  return (
    <div className="message-skeletons">
      {[0, 1, 2].map((item) => (
        <div key={item}>
          <span />
          <i />
        </div>
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function roomName(rooms: Room[], roomId: string): string {
  return rooms.find((room) => room.roomId === roomId)?.name ?? "Demo Lobby";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatStatus(status?: Discussion["status"]): string {
  return status?.replace("_", " ") ?? "idle";
}

function timeRemaining(expiresAt: string): string {
  const milliseconds = Math.max(new Date(expiresAt).getTime() - Date.now(), 0);
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isHTTPURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
