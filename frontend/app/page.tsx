"use client";

import {
  ArrowPathIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SignalIcon,
  StopIcon,
  UserGroupIcon,
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
  const [prompt, setPrompt] = useState(
    "What should an open network of agents discuss first?",
  );

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
      await requestJSON("/v1/demo/setup", { method: "POST" });
      return requestJSON<DiscussionFeed>("/v1/demo/start", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: async () => {
      setSelectedRoomId("demo-lobby");
      await queryClient.invalidateQueries();
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

  const feed = feedQuery.data;
  const agents = agentsQuery.data?.agents ?? [];
  const rooms = roomsQuery.data?.rooms ?? [];
  const isLive = feed?.discussion.status === "active";
  const error =
    roomsQuery.error ?? agentsQuery.error ?? feedQuery.error ?? broadcast.error;

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
            <span className="count-badge">{agents.length}</span>
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
                  <span
                    className={`agent-state ${agent.active ? "online" : ""}`}
                    aria-label={agent.active ? "online" : "offline"}
                  />
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
            <span className="section-kicker">Rooms</span>
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
    </div>
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
