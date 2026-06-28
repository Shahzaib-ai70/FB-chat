export type Role = "customer" | "agent";

export type ChatStatus = "open" | "resolved";

export interface MessageReaction {
  emoji: string;
  reactors: Role[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: Role;
  text: string;
  mediaUrl?: string;
  mediaType?: "image";
  reactions: MessageReaction[];
  deleted: boolean;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  customerName: string;
  isOnline: boolean;
  status: ChatStatus;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
}

export interface SessionBootstrap {
  session: ChatSession;
  messages: ChatMessage[];
}

export interface AgentBootstrap {
  sessions: ChatSession[];
  messagesBySession: Record<string, ChatMessage[]>;
}

export interface TypingState {
  sessionId: string;
  role: Role;
  isTyping: boolean;
}

export interface SessionInitPayload {
  sessionId?: string;
  customerName: string;
}

export interface OutboundMessage {
  sessionId: string;
  sender: Role;
  text: string;
  mediaUrl?: string;
  mediaType?: "image";
}

export interface DeleteMessagePayload {
  sessionId: string;
  messageId: string;
}

export interface ToggleReactionPayload {
  sessionId: string;
  messageId: string;
  emoji: string;
  reactor: Role;
}

export const cannedReplies = [
  "Thanks for reaching out. I am checking that for you now.",
  "I can help with that. Could you share a little more detail?",
  "Your request is in progress. I will stay with you until it is resolved.",
];

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createGuestName(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Guest ${suffix}`;
}

export function sortSessionsByActivity(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((left, right) => {
    const rightTime = new Date(right.updatedAt).getTime();
    const leftTime = new Date(left.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

export function upsertSession(
  sessions: ChatSession[],
  incoming: ChatSession,
): ChatSession[] {
  const remaining = sessions.filter((session) => session.id !== incoming.id);
  return sortSessionsByActivity([...remaining, incoming]);
}

export function appendMessage(
  messagesBySession: Record<string, ChatMessage[]>,
  message: ChatMessage,
): Record<string, ChatMessage[]> {
  const existing = messagesBySession[message.sessionId] ?? [];
  return {
    ...messagesBySession,
    [message.sessionId]: [...existing, message],
  };
}

export function updateMessage(
  messagesBySession: Record<string, ChatMessage[]>,
  incoming: ChatMessage,
): Record<string, ChatMessage[]> {
  const existing = messagesBySession[incoming.sessionId] ?? [];
  return {
    ...messagesBySession,
    [incoming.sessionId]: existing.map((message) =>
      message.id === incoming.id ? incoming : message
    ),
  };
}
