import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import {
  appendMessage,
  type DeleteMessagePayload,
  type AgentBootstrap,
  type ChatMessage,
  type ChatSession,
  type OutboundMessage,
  type Role,
  type SessionBootstrap,
  type TypingState,
  type ToggleReactionPayload,
  updateMessage,
  upsertSession,
} from "../../shared/chat";

const CUSTOMER_SESSION_STORAGE_KEY = "fb-chat-customer-session";
const AGENT_SESSION_STORAGE_KEY = "fb-chat-agent-selected-session";

function resolveServerUrl(): string | undefined {
  const configuredUrl = import.meta.env.VITE_SERVER_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  return undefined;
}

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

interface StoredCustomerSession {
  customerName: string;
  sessionId: string;
}

function readStoredCustomerSession(): StoredCustomerSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(CUSTOMER_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredCustomerSession>;
    if (
      typeof parsed.customerName === "string" &&
      parsed.customerName.trim() &&
      typeof parsed.sessionId === "string" &&
      parsed.sessionId.trim()
    ) {
      return {
        customerName: parsed.customerName.trim(),
        sessionId: parsed.sessionId.trim(),
      };
    }
  } catch {
    window.localStorage.removeItem(CUSTOMER_SESSION_STORAGE_KEY);
  }

  return null;
}

function writeStoredCustomerSession(session: StoredCustomerSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CUSTOMER_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readStoredAgentSelection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(AGENT_SESSION_STORAGE_KEY)?.trim() || null;
}

function writeStoredAgentSelection(sessionId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!sessionId) {
    window.localStorage.removeItem(AGENT_SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AGENT_SESSION_STORAGE_KEY, sessionId);
}

const storedCustomerSession = readStoredCustomerSession();
const storedAgentSelection = readStoredAgentSelection();

interface ChatState {
  role: Role | null;
  socket: Socket | null;
  sessionId: string | null;
  customerName: string;
  selectedSessionId: string | null;
  sessions: ChatSession[];
  messagesBySession: Record<string, ChatMessage[]>;
  typingBySession: Record<string, Partial<Record<Role, boolean>>>;
  connectionState: ConnectionState;
  agentOnlineCount: number;
  error: string | null;
  connect: (role: Role) => void;
  setCustomerName: (customerName: string) => void;
  initCustomerSession: (customerNameOverride?: string) => void;
  subscribeAgent: () => void;
  selectSession: (sessionId: string) => void;
  sendMessage: (payload: { text?: string; mediaUrl?: string; mediaType?: "image" }) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  setTyping: (isTyping: boolean) => void;
  resolveActiveSession: () => void;
}

export function pickNextSessionId(
  sessions: ChatSession[],
  currentId: string | null,
): string | null {
  if (currentId && sessions.some((session) => session.id === currentId)) {
    return currentId;
  }

  return sessions[0]?.id ?? null;
}

export const useChatStore = create<ChatState>((set, get) => ({
  role: null,
  socket: null,
  sessionId: storedCustomerSession?.sessionId ?? null,
  customerName: storedCustomerSession?.customerName ?? "",
  selectedSessionId: storedAgentSelection,
  sessions: [],
  messagesBySession: {},
  typingBySession: {},
  connectionState: "idle",
  agentOnlineCount: 0,
  error: null,
  connect: (role) => {
    const currentSocket = get().socket;

    if (currentSocket && get().role === role) {
      return;
    }

    currentSocket?.disconnect();
    set({ connectionState: "connecting", role, error: null });

    const socket = io(resolveServerUrl(), {
      autoConnect: true,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      set({ connectionState: "connected", error: null });

      if (role === "customer") {
        const storedSession = readStoredCustomerSession();
        if (storedSession) {
          socket.emit("session:init", storedSession);
        }
      }
    });

    socket.on("disconnect", () => {
      set({ connectionState: "disconnected" });
    });

    socket.on("chat:error", (payload: { message: string }) => {
      set({ error: payload.message });
    });

    socket.on("agent:presence", (payload: { onlineCount: number }) => {
      set({ agentOnlineCount: payload.onlineCount });
    });

    socket.on("session:ready", (payload: SessionBootstrap) => {
      writeStoredCustomerSession({
        customerName: payload.session.customerName,
        sessionId: payload.session.id,
      });
      set((state) => ({
        sessionId: payload.session.id,
        customerName: payload.session.customerName,
        sessions: upsertSession(state.sessions, payload.session),
        messagesBySession: {
          ...state.messagesBySession,
          [payload.session.id]: payload.messages,
        },
      }));
    });

    socket.on("agent:bootstrap", (payload: AgentBootstrap) => {
      set((state) => {
        const selectedSessionId = pickNextSessionId(payload.sessions, state.selectedSessionId);
        writeStoredAgentSelection(selectedSessionId);
        return {
          sessions: payload.sessions,
          messagesBySession: payload.messagesBySession,
          selectedSessionId,
        };
      });
    });

    socket.on("session:updated", (session: ChatSession) => {
      set((state) => {
        const sessions = upsertSession(state.sessions, session);
        const selectedSessionId = pickNextSessionId(sessions, state.selectedSessionId);
        writeStoredAgentSelection(selectedSessionId);
        return {
          sessions,
          selectedSessionId,
        };
      });
    });

    socket.on("message:new", (message: ChatMessage) => {
      set((state) => ({
        messagesBySession: appendMessage(state.messagesBySession, message),
      }));
    });

    socket.on("message:update", (message: ChatMessage) => {
      set((state) => ({
        messagesBySession: updateMessage(state.messagesBySession, message),
      }));
    });

    socket.on("typing:state", (typingState: TypingState) => {
      set((state) => ({
        typingBySession: {
          ...state.typingBySession,
          [typingState.sessionId]: {
            ...state.typingBySession[typingState.sessionId],
            [typingState.role]: typingState.isTyping,
          },
        },
      }));
    });

    set({ socket });
  },
  setCustomerName: (customerName) => {
    const trimmed = customerName.trim();
    set({ customerName: trimmed });
  },
  initCustomerSession: (customerNameOverride) => {
    const socket = get().socket;
    if (!socket) {
      return;
    }

    const customerName = customerNameOverride?.trim() || get().customerName;
    if (!customerName.trim()) {
      return;
    }

    const existingSessionId = get().sessionId;
    const payload = existingSessionId
      ? { customerName, sessionId: existingSessionId }
      : { customerName };

    set({ customerName });
    socket.emit("session:init", payload);
  },
  subscribeAgent: () => {
    get().socket?.emit("agent:subscribe");
  },
  selectSession: (sessionId) => {
    writeStoredAgentSelection(sessionId);
    set({ selectedSessionId: sessionId });
    get().socket?.emit("session:focus", sessionId);
  },
  sendMessage: ({ text = "", mediaUrl, mediaType }) => {
    const trimmed = text.trim();
    if (!trimmed && !mediaUrl) {
      return;
    }

    const { role, sessionId, selectedSessionId, socket } = get();
    const targetSessionId = role === "agent" ? selectedSessionId : sessionId;
    if (!socket || !role || !targetSessionId) {
      return;
    }

    const payload: OutboundMessage = {
      sessionId: targetSessionId,
      sender: role,
      text: trimmed,
      mediaUrl,
      mediaType,
    };
    socket.emit("message:send", payload);
  },
  deleteMessage: (messageId) => {
    const { sessionId, selectedSessionId, socket, role } = get();
    const targetSessionId = role === "agent" ? selectedSessionId : sessionId;
    if (!socket || !targetSessionId) {
      return;
    }

    const payload: DeleteMessagePayload = {
      sessionId: targetSessionId,
      messageId,
    };
    socket.emit("message:delete", payload);
  },
  toggleReaction: (messageId, emoji) => {
    const { role, sessionId, selectedSessionId, socket } = get();
    const targetSessionId = role === "agent" ? selectedSessionId : sessionId;
    if (!socket || !role || !targetSessionId) {
      return;
    }

    const payload: ToggleReactionPayload = {
      sessionId: targetSessionId,
      messageId,
      emoji,
      reactor: role,
    };
    socket.emit("message:react", payload);
  },
  setTyping: (isTyping) => {
    const { role, sessionId, selectedSessionId, socket } = get();
    const targetSessionId = role === "agent" ? selectedSessionId : sessionId;
    if (!socket || !role || !targetSessionId) {
      return;
    }

    socket.emit("typing:update", {
      sessionId: targetSessionId,
      role,
      isTyping,
    });
  },
  resolveActiveSession: () => {
    const sessionId = get().selectedSessionId;
    if (!sessionId) {
      return;
    }

    get().socket?.emit("session:resolve", sessionId);
  },
}));
