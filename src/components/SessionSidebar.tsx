import { CheckCircle2, Clock3, MessageSquareText } from "lucide-react";
import type { ChatSession } from "../../shared/chat";

interface SessionSidebarProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function formatUpdatedAt(isoString: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function SessionSidebar({
  sessions,
  selectedSessionId,
  onSelect,
}: SessionSidebarProps) {
  return (
    <aside className="sidebar-panel">
      <div className="sidebar-header">
        <p className="eyebrow">Active Queue</p>
        <h2>Customer sessions</h2>
      </div>
      <div className="session-list" role="list">
        {sessions.length === 0 ? (
          <div className="empty-state compact">
            <p className="eyebrow">Waiting</p>
            <h3>No customers yet</h3>
            <p>New customer conversations appear here as soon as they send a message.</p>
          </div>
        ) : null}
        {sessions.map((session) => {
          const isSelected = selectedSessionId === session.id;
          return (
            <button
              className={`session-card ${isSelected ? "selected" : ""}`}
              key={session.id}
              onClick={() => onSelect(session.id)}
              type="button"
            >
              <div className="session-row">
                <div>
                  <div className="name-row">
                    <strong>{session.customerName}</strong>
                    <span className={`live-indicator ${session.isOnline ? "online" : "offline"}`}>
                      <span className="live-dot" />
                      {session.isOnline ? "online" : "offline"}
                    </span>
                  </div>
                  <span className="session-time">{formatUpdatedAt(session.updatedAt)}</span>
                </div>
                <span className={`status-chip ${session.status}`}>
                  {session.status === "resolved" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                  {session.status}
                </span>
              </div>
              <p className="session-preview">{session.lastMessagePreview}</p>
              <div className="session-row footer">
                <span className="queue-meta">
                  <MessageSquareText size={14} />
                  Session {session.id.slice(-4).toUpperCase()}
                </span>
                {session.unreadCount > 0 ? (
                  <span className="unread-pill">{session.unreadCount}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
