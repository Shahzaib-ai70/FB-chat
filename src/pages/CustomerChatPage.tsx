import { useEffect, useState } from "react";
import { ConversationFeed } from "../components/ConversationFeed";
import { MessageComposer } from "../components/MessageComposer";
import { useChatStore } from "../store/chatStore";

export function CustomerChatPage() {
  const {
    agentOnlineCount,
    connect,
    connectionState,
    customerName,
    deleteMessage,
    initCustomerSession,
    logoutCustomer,
    messagesBySession,
    sendMessage,
    setCustomerName,
    sessionId,
    setTyping,
    toggleReaction,
    typingBySession,
  } = useChatStore();
  const [draftName, setDraftName] = useState(customerName);

  useEffect(() => {
    connect("customer");
  }, [connect]);

  useEffect(() => {
    setDraftName(customerName);
  }, [customerName]);

  useEffect(() => {
    document.title = "Facebook Chat";
  }, []);

  const messages = sessionId ? messagesBySession[sessionId] ?? [] : [];
  const typingRole = sessionId && typingBySession[sessionId]?.agent ? "agent" : undefined;
  const showNamePrompt = !sessionId;

  function handleOpenChat() {
    const trimmed = draftName.trim();
    if (!trimmed || connectionState !== "connected") {
      return;
    }

    setCustomerName(trimmed);
    initCustomerSession(trimmed);
  }

  return (
    <section className="workspace customer-chat-only">
      <div className="chat-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Facebook Chat</p>
            <h2>{customerName || "Login to continue"}</h2>
          </div>
          <div className="panel-actions">
            {sessionId ? (
              <button className="logout-button" onClick={logoutCustomer} type="button">
                Logout
              </button>
            ) : null}
            <span
              aria-label={agentOnlineCount > 0 ? "Support online" : "Support offline"}
              className={`presence-dot ${agentOnlineCount > 0 ? "online" : "offline"}`}
              title={agentOnlineCount > 0 ? "Support online" : "Support offline"}
            >
              <span className="live-dot" />
            </span>
          </div>
        </div>
        <ConversationFeed
          customerName={customerName}
          emptyTitle="Inbox ready"
          compactEmptyState
          messages={messages}
          onDeleteMessage={deleteMessage}
          onToggleReaction={toggleReaction}
          typingRole={typingRole}
        />
        <MessageComposer
          disabled={!sessionId}
          onSend={sendMessage}
          onTyping={setTyping}
          placeholder="Write a message..."
        />
      </div>
      {showNamePrompt ? (
        <div className="name-overlay" role="dialog" aria-modal="true" aria-labelledby="chat-name-title">
          <div className="name-modal">
            <div className="facebook-logo large" aria-hidden="true">
              <span>f</span>
            </div>
            <p className="eyebrow">Facebook Chat</p>
            <h2 id="chat-name-title">Add your name to open chat</h2>
            <p className="hero-copy">
              Enter your name to login or reopen your old chat history with support.
            </p>
            <input
              className="name-input"
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleOpenChat();
                }
              }}
              placeholder="Enter your name"
              type="text"
              value={draftName}
            />
            <button
              className="open-chat-button"
              disabled={!draftName.trim() || connectionState !== "connected"}
              onClick={handleOpenChat}
              type="button"
            >
              Login / Open Chat
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
