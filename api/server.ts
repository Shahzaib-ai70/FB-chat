import express from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { Server, type Socket as ServerSocket } from "socket.io";
import {
  appendMessage,
  createId,
  type DeleteMessagePayload,
  type AgentBootstrap,
  type ChatMessage,
  type ChatSession,
  type OutboundMessage,
  type SessionInitPayload,
  type TypingState,
  type ToggleReactionPayload,
  upsertSession,
} from "../shared/chat";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const clientBuildPath = path.resolve(projectRoot, "dist");
const dataDirectoryPath = path.resolve(projectRoot, "data");
const dataFilePath = path.resolve(dataDirectoryPath, "chat-data.json");
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 3001);
const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultDevOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const socketCorsOrigins = configuredOrigins?.length
  ? configuredOrigins
  : isProduction
    ? undefined
    : defaultDevOrigins;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, socketCorsOrigins
  ? {
      cors: {
        origin: socketCorsOrigins,
        methods: ["GET", "POST"],
      },
    }
  : undefined);

const sessions = new Map<string, ChatSession>();
const messagesBySession = new Map<string, ChatMessage[]>();
const typingBySession = new Map<string, Record<string, boolean>>();
const agentSockets = new Set<string>();
const customerSocketsBySession = new Map<string, Set<string>>();

interface PersistedChatData {
  sessions: ChatSession[];
  messagesBySession: Record<string, ChatMessage[]>;
}

function normalizeCustomerName(customerName: string): string {
  return customerName.trim().toLowerCase();
}

function serializeChatData(): PersistedChatData {
  return {
    sessions: getAllSessions(),
    messagesBySession: getMessagesRecord(),
  };
}

function persistChatData(): void {
  mkdirSync(dataDirectoryPath, { recursive: true });
  writeFileSync(dataFilePath, JSON.stringify(serializeChatData(), null, 2), "utf-8");
}

function loadPersistedChatData(): void {
  mkdirSync(dataDirectoryPath, { recursive: true });
  if (!existsSync(dataFilePath)) {
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(dataFilePath, "utf-8")) as Partial<PersistedChatData>;
    sessions.clear();
    messagesBySession.clear();

    for (const session of parsed.sessions ?? []) {
      sessions.set(session.id, session);
    }

    for (const [sessionId, messages] of Object.entries(parsed.messagesBySession ?? {})) {
      messagesBySession.set(sessionId, messages);
    }
  } catch (error) {
    console.error("Unable to load persisted chat data.", error);
  }
}

function getAllSessions(): ChatSession[] {
  return [...sessions.values()].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function getMessagesRecord(): Record<string, ChatMessage[]> {
  return [...messagesBySession.entries()].reduce<Record<string, ChatMessage[]>>(
    (record, [sessionId, messages]) => {
      record[sessionId] = messages;
      return record;
    },
    {},
  );
}

function broadcastAgentPresence(): void {
  io.emit("agent:presence", { onlineCount: agentSockets.size });
}

function storeSession(incoming: ChatSession): ChatSession {
  const next = upsertSession(getAllSessions(), incoming).find(
    (session) => session.id === incoming.id,
  );

  if (!next) {
    sessions.set(incoming.id, incoming);
    persistChatData();
    return incoming;
  }

  sessions.set(next.id, next);
  persistChatData();
  return next;
}

function emitSessionUpdate(session: ChatSession): void {
  io.to("agents").emit("session:updated", session);
  io.to(`session:${session.id}`).emit("session:updated", session);
}

function emitMessageUpdate(message: ChatMessage): void {
  io.to("agents").emit("message:update", message);
  io.to(`session:${message.sessionId}`).emit("message:update", message);
}

function buildPreview(message: Pick<ChatMessage, "text" | "mediaType" | "deleted">): string {
  if (message.deleted) {
    return "Message deleted";
  }

  if (message.text.trim()) {
    return message.text.trim();
  }

  if (message.mediaType === "image") {
    return "Image sent";
  }

  return "New message";
}

function createSession(customerName: string): ChatSession {
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: createId("session"),
    customerName,
    isOnline: true,
    status: "open",
    unreadCount: 0,
    createdAt: now,
    updatedAt: now,
    lastMessagePreview: "Conversation started.",
  };
  sessions.set(session.id, session);
  messagesBySession.set(session.id, []);
  persistChatData();
  return session;
}

function findSessionByCustomerName(customerName: string): ChatSession | undefined {
  const normalizedCustomerName = normalizeCustomerName(customerName);
  return getAllSessions().find(
    (session) => normalizeCustomerName(session.customerName) === normalizedCustomerName,
  );
}

function getOrCreateSession(payload: SessionInitPayload): ChatSession {
  const trimmedCustomerName = payload.customerName.trim();
  const existing = payload.sessionId ? sessions.get(payload.sessionId) : undefined;
  if (existing) {
    const nextSession = storeSession({
      ...existing,
      customerName: trimmedCustomerName,
      isOnline: true,
      status: "open",
    });
    return nextSession;
  }

  const existingByName = findSessionByCustomerName(trimmedCustomerName);
  if (existingByName) {
    return storeSession({
      ...existingByName,
      customerName: trimmedCustomerName,
      isOnline: true,
      status: "open",
    });
  }

  return createSession(trimmedCustomerName);
}

function updateTypingState(state: TypingState): void {
  const entry = typingBySession.get(state.sessionId) ?? {};
  entry[state.role] = state.isTyping;
  typingBySession.set(state.sessionId, entry);
  io.to("agents").emit("typing:state", state);
  io.to(`session:${state.sessionId}`).emit("typing:state", state);
}

function pushMessage(payload: OutboundMessage): ChatMessage {
  const now = new Date().toISOString();
  const text = payload.text.trim();
  const message: ChatMessage = {
    id: createId("message"),
    sessionId: payload.sessionId,
    sender: payload.sender,
    text,
    mediaUrl: payload.mediaUrl,
    mediaType: payload.mediaType,
    reactions: [],
    deleted: false,
    timestamp: now,
  };

  const session = sessions.get(payload.sessionId);
  if (!session) {
    throw new Error("Session not found");
  }

  const currentMessages = getMessagesRecord();
  const nextMessages = appendMessage(currentMessages, message);
  messagesBySession.set(payload.sessionId, nextMessages[payload.sessionId]);

  const nextSession: ChatSession = {
    ...session,
    isOnline: session.isOnline,
    status: "open",
    unreadCount: payload.sender === "customer" ? session.unreadCount + 1 : 0,
    updatedAt: now,
    lastMessagePreview: buildPreview(message),
  };

  sessions.set(nextSession.id, nextSession);
  persistChatData();
  updateTypingState({ sessionId: payload.sessionId, role: payload.sender, isTyping: false });
  io.to("agents").emit("message:new", message);
  io.to(`session:${payload.sessionId}`).emit("message:new", message);
  emitSessionUpdate(nextSession);
  return message;
}

function updateStoredMessage(sessionId: string, updatedMessage: ChatMessage): void {
  const existingMessages = messagesBySession.get(sessionId) ?? [];
  messagesBySession.set(
    sessionId,
    existingMessages.map((message) =>
      message.id === updatedMessage.id ? updatedMessage : message
    ),
  );
  persistChatData();
}

function findMessage(sessionId: string, messageId: string): ChatMessage {
  const existingMessages = messagesBySession.get(sessionId) ?? [];
  const message = existingMessages.find((entry) => entry.id === messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  return message;
}

function refreshSessionPreview(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  const sessionMessages = messagesBySession.get(sessionId) ?? [];
  const latestMessage = sessionMessages[sessionMessages.length - 1];
  const nextSession = storeSession({
    ...session,
    updatedAt: new Date().toISOString(),
    lastMessagePreview: latestMessage ? buildPreview(latestMessage) : "Conversation started.",
  });
  emitSessionUpdate(nextSession);
}

function detachCustomerSocket(socket: ServerSocket): void {
  if (socket.data.role !== "customer" || typeof socket.data.sessionId !== "string") {
    return;
  }

  const sessionId = socket.data.sessionId;
  updateTypingState({ sessionId, role: "customer", isTyping: false });
  socket.leave(`session:${sessionId}`);

  const sockets = customerSocketsBySession.get(sessionId);
  if (sockets) {
    sockets.delete(socket.id);

    if (sockets.size === 0) {
      customerSocketsBySession.delete(sessionId);
      const session = sessions.get(sessionId);
      if (session) {
        const nextSession = storeSession({
          ...session,
          isOnline: false,
        });
        emitSessionUpdate(nextSession);
      }
    } else {
      customerSocketsBySession.set(sessionId, sockets);
    }
  }

  delete socket.data.role;
  delete socket.data.sessionId;
}

function deleteMessage(payload: DeleteMessagePayload): ChatMessage {
  const message = findMessage(payload.sessionId, payload.messageId);
  const updatedMessage: ChatMessage = {
    ...message,
    text: "",
    mediaUrl: undefined,
    mediaType: undefined,
    reactions: [],
    deleted: true,
  };
  updateStoredMessage(payload.sessionId, updatedMessage);
  refreshSessionPreview(payload.sessionId);
  emitMessageUpdate(updatedMessage);
  return updatedMessage;
}

function toggleReaction(payload: ToggleReactionPayload): ChatMessage {
  const message = findMessage(payload.sessionId, payload.messageId);
  if (message.deleted) {
    return message;
  }

  const existingReaction = message.reactions.find((reaction) => reaction.emoji === payload.emoji);
  let nextReactions = message.reactions;

  if (!existingReaction) {
    nextReactions = [
      ...message.reactions,
      {
        emoji: payload.emoji,
        reactors: [payload.reactor],
      },
    ];
  } else if (existingReaction.reactors.includes(payload.reactor)) {
    const remainingReactors = existingReaction.reactors.filter(
      (reactor) => reactor !== payload.reactor,
    );
    nextReactions = remainingReactors.length > 0
      ? message.reactions.map((reaction) =>
          reaction.emoji === payload.emoji ? { ...reaction, reactors: remainingReactors } : reaction
        )
      : message.reactions.filter((reaction) => reaction.emoji !== payload.emoji);
  } else {
    nextReactions = message.reactions.map((reaction) =>
      reaction.emoji === payload.emoji
        ? { ...reaction, reactors: [...reaction.reactors, payload.reactor] }
        : reaction
    );
  }

  const updatedMessage: ChatMessage = {
    ...message,
    reactions: nextReactions,
  };
  updateStoredMessage(payload.sessionId, updatedMessage);
  emitMessageUpdate(updatedMessage);
  return updatedMessage;
}

app.get("/health", (_request, response) => {
  response.json({ ok: true, sessions: sessions.size, agentsOnline: agentSockets.size });
});

loadPersistedChatData();

if (existsSync(path.join(clientBuildPath, "index.html"))) {
  app.use(express.static(clientBuildPath));

  app.get("*", (request, response, next) => {
    if (request.path === "/health") {
      next();
      return;
    }

    response.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

io.on("connection", (socket) => {
  socket.on("agent:subscribe", () => {
    agentSockets.add(socket.id);
    socket.join("agents");
    const bootstrap: AgentBootstrap = {
      sessions: getAllSessions(),
      messagesBySession: getMessagesRecord(),
    };
    socket.emit("agent:bootstrap", bootstrap);
    broadcastAgentPresence();
  });

  socket.on("session:init", (payload: SessionInitPayload) => {
    detachCustomerSocket(socket);
    const session = getOrCreateSession(payload);
    const customerSockets = customerSocketsBySession.get(session.id) ?? new Set<string>();
    customerSockets.add(socket.id);
    customerSocketsBySession.set(session.id, customerSockets);

    socket.join(`session:${session.id}`);
    socket.data.role = "customer";
    socket.data.sessionId = session.id;

    socket.emit("session:ready", {
      session,
      messages: messagesBySession.get(session.id) ?? [],
    });
    socket.emit("agent:presence", { onlineCount: agentSockets.size });
    io.to("agents").emit("session:updated", session);
  });

  socket.on("session:logout", () => {
    detachCustomerSocket(socket);
  });

  socket.on("session:focus", (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    const nextSession = storeSession({ ...session, unreadCount: 0 });
    emitSessionUpdate(nextSession);
  });

  socket.on("message:send", (payload: OutboundMessage) => {
    if (!payload.text.trim() && !payload.mediaUrl) {
      return;
    }

    try {
      pushMessage(payload);
    } catch (error) {
      socket.emit("chat:error", {
        message: error instanceof Error ? error.message : "Unable to send message",
      });
    }
  });

  socket.on("typing:update", (state: TypingState) => {
    updateTypingState(state);
  });

  socket.on("message:delete", (payload: DeleteMessagePayload) => {
    try {
      deleteMessage(payload);
    } catch (error) {
      socket.emit("chat:error", {
        message: error instanceof Error ? error.message : "Unable to delete message",
      });
    }
  });

  socket.on("message:react", (payload: ToggleReactionPayload) => {
    try {
      toggleReaction(payload);
    } catch (error) {
      socket.emit("chat:error", {
        message: error instanceof Error ? error.message : "Unable to update reaction",
      });
    }
  });

  socket.on("session:resolve", (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) {
      return;
    }

    const nextSession = storeSession({
      ...session,
      status: "resolved",
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      lastMessagePreview: session.lastMessagePreview || "Conversation resolved.",
    });
    updateTypingState({ sessionId, role: "agent", isTyping: false });
    updateTypingState({ sessionId, role: "customer", isTyping: false });
    emitSessionUpdate(nextSession);
  });

  socket.on("disconnect", () => {
    if (agentSockets.delete(socket.id)) {
      broadcastAgentPresence();
    }

    detachCustomerSocket(socket);
  });
});

httpServer.listen(port, () => {
  console.log(`Realtime chat server listening on port ${port}`);
});
