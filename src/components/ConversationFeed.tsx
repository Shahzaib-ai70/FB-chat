import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import type { ChatMessage, Role } from "../../shared/chat";

interface ConversationFeedProps {
  messages: ChatMessage[];
  customerName: string;
  typingRole?: Role;
  emptyTitle: string;
  emptyText?: string;
  emptyHeading?: string;
  compactEmptyState?: boolean;
  onDeleteMessage: (messageId: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

const reactionOptions = ["❤️", "🔥", "👍", "😂"];

export function ConversationFeed({
  messages,
  customerName,
  typingRole,
  emptyTitle,
  emptyText,
  emptyHeading,
  compactEmptyState,
  onDeleteMessage,
  onToggleReaction,
}: ConversationFeedProps) {
  const endOfFeedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endOfFeedRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingRole]);

  if (messages.length === 0) {
    return (
      <div className={`empty-state ${compactEmptyState ? "centered" : ""}`} aria-live="polite">
        <p className="eyebrow">{emptyTitle}</p>
        {emptyHeading ? <h3>{emptyHeading}</h3> : null}
        {emptyText ? <p>{emptyText}</p> : null}
      </div>
    );
  }

  return (
    <div className="conversation-feed" aria-live="polite">
      {messages.map((message) => {
        const isAgent = message.sender === "agent";
        return (
          <article
            className={`bubble-row ${isAgent ? "agent" : "customer"}`}
            key={message.id}
          >
            <div className={`message-bubble ${isAgent ? "agent" : "customer"}`}>
              <button
                aria-label="Delete message"
                className="message-delete-button"
                onClick={() => onDeleteMessage(message.id)}
                type="button"
              >
                <Trash2 size={14} />
              </button>
              {message.deleted ? (
                <p className="deleted-message">Message deleted</p>
              ) : (
                <>
                  {message.mediaUrl ? (
                    <img
                      alt="Shared chat media"
                      className="message-media"
                      src={message.mediaUrl}
                    />
                  ) : null}
                  {message.text ? <p>{message.text}</p> : null}
                  <div className="reaction-bar">
                    {reactionOptions.map((emoji) => {
                      const reaction = message.reactions.find((entry) => entry.emoji === emoji);
                      const count = reaction?.reactors.length ?? 0;
                      return (
                        <button
                          className={`reaction-chip ${count > 0 ? "active" : ""}`}
                          key={emoji}
                          onClick={() => onToggleReaction(message.id, emoji)}
                          type="button"
                        >
                          <span>{emoji}</span>
                          {count > 0 ? <span>{count}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </article>
        );
      })}
      {typingRole ? (
        <div className="typing-indicator" aria-label={`${typingRole} is typing`}>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span>{typingRole === "agent" ? "Agent is typing..." : `${customerName} is typing...`}</span>
        </div>
      ) : null}
      <div aria-hidden="true" className="feed-end-anchor" ref={endOfFeedRef} />
    </div>
  );
}
