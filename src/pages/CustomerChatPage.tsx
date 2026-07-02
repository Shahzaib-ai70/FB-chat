import { useEffect, useRef, useState } from "react";
import { createGuestName } from "../../shared/chat";
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
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const hasRequestedAutoStart = useRef(false);

  useEffect(() => {
    connect("customer");
  }, [connect]);

  useEffect(() => {
    document.title = "Facebook Chat";
  }, []);

  useEffect(() => {
    if (sessionId) {
      hasRequestedAutoStart.current = false;
      setIsLoggedOut(false);
      return;
    }

    if (connectionState !== "connected" || isLoggedOut || hasRequestedAutoStart.current) {
      return;
    }

    const nextName = customerName.trim() || createGuestName();
    hasRequestedAutoStart.current = true;
    setCustomerName(nextName);
    initCustomerSession(nextName);
  }, [connectionState, customerName, initCustomerSession, isLoggedOut, sessionId, setCustomerName]);

  const messages = sessionId ? messagesBySession[sessionId] ?? [] : [];
  const typingRole = sessionId && typingBySession[sessionId]?.agent ? "agent" : undefined;

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
              <button
                className="logout-button"
                onClick={() => {
                  hasRequestedAutoStart.current = false;
                  setIsLoggedOut(true);
                  logoutCustomer();
                }}
                type="button"
              >
                Logout
              </button>
            ) : (
              <button
                className="logout-button"
                onClick={() => {
                  const nextName = customerName.trim() || createGuestName();
                  hasRequestedAutoStart.current = true;
                  setIsLoggedOut(false);
                  setCustomerName(nextName);
                  initCustomerSession(nextName);
                }}
                type="button"
              >
                Login
              </button>
            )}
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
    </section>
  );
}
