import { useEffect, useMemo } from "react";
import { BellRing, Gauge, Inbox, LifeBuoy } from "lucide-react";
import { cannedReplies } from "../../shared/chat";
import { ConversationFeed } from "../components/ConversationFeed";
import { MessageComposer } from "../components/MessageComposer";
import { SessionSidebar } from "../components/SessionSidebar";
import { useChatStore } from "../store/chatStore";

export function AgentConsolePage() {
  const {
    agentOnlineCount,
    connect,
    connectionState,
    deleteMessage,
    messagesBySession,
    resolveActiveSession,
    selectSession,
    selectedSessionId,
    sendMessage,
    sessions,
    setTyping,
    subscribeAgent,
    toggleReaction,
    typingBySession,
  } = useChatStore();

  useEffect(() => {
    connect("agent");
  }, [connect]);

  useEffect(() => {
    if (connectionState === "connected") {
      subscribeAgent();
    }
  }, [connectionState, subscribeAgent]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions],
  );
  const messages = selectedSessionId ? messagesBySession[selectedSessionId] ?? [] : [];
  const typingRole = selectedSessionId && typingBySession[selectedSessionId]?.customer
    ? "customer"
    : undefined;
  const openCount = sessions.filter((session) => session.status === "open").length;
  const unreadCount = sessions.reduce((total, session) => total + session.unreadCount, 0);

  return (
    <section className="workspace agent-layout">
      <SessionSidebar
        onSelect={selectSession}
        selectedSessionId={selectedSessionId}
        sessions={sessions}
      />
      <div className="console-panel">
        <div className="console-banner">
          <article className="stat-card">
            <Gauge size={18} />
            <span>Connection</span>
            <strong>{connectionState}</strong>
          </article>
          <article className="stat-card">
            <Inbox size={18} />
            <span>Open sessions</span>
            <strong>{openCount}</strong>
          </article>
          <article className="stat-card">
            <BellRing size={18} />
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </article>
          <article className="stat-card">
            <LifeBuoy size={18} />
            <span>Agents online</span>
            <strong>{agentOnlineCount}</strong>
          </article>
        </div>
        <div className="chat-panel agent-chat">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Agent Console</p>
              <h2>{selectedSession?.customerName ?? "Select a conversation"}</h2>
            </div>
            {selectedSession ? (
              <button className="resolve-button" onClick={resolveActiveSession} type="button">
                Mark resolved
              </button>
            ) : null}
          </div>
          <ConversationFeed
            customerName={selectedSession?.customerName ?? "Customer"}
            emptyText="When a customer sends the first message, the transcript loads here."
            emptyTitle="Queue"
            emptyHeading="No messages yet"
            messages={messages}
            onDeleteMessage={deleteMessage}
            onToggleReaction={toggleReaction}
            typingRole={typingRole}
          />
          <MessageComposer
            disabled={!selectedSession}
            onSend={sendMessage}
            onTyping={setTyping}
            placeholder="Write a helpful reply..."
            quickReplies={cannedReplies}
          />
        </div>
      </div>
    </section>
  );
}
