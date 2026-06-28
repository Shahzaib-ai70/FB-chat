import { describe, expect, it } from "vitest";
import { appendMessage, upsertSession } from "../../shared/chat";
import { pickNextSessionId } from "./chatStore";

describe("chat data helpers", () => {
  it("keeps the current selection when it still exists", () => {
    const sessions = [
      {
        id: "session-1",
        customerName: "Guest A1",
        isOnline: true,
        status: "open" as const,
        unreadCount: 0,
        createdAt: "2026-06-22T08:00:00.000Z",
        updatedAt: "2026-06-22T08:01:00.000Z",
        lastMessagePreview: "Hello",
      },
      {
        id: "session-2",
        customerName: "Guest A2",
        isOnline: true,
        status: "open" as const,
        unreadCount: 0,
        createdAt: "2026-06-22T08:00:00.000Z",
        updatedAt: "2026-06-22T08:02:00.000Z",
        lastMessagePreview: "Need help",
      },
    ];

    expect(pickNextSessionId(sessions, "session-1")).toBe("session-1");
  });

  it("falls back to the most recent session when the selection disappears", () => {
    const nextSessions = upsertSession(
      [
        {
          id: "session-1",
          customerName: "Guest A1",
          isOnline: true,
          status: "open" as const,
          unreadCount: 1,
          createdAt: "2026-06-22T08:00:00.000Z",
          updatedAt: "2026-06-22T08:00:00.000Z",
          lastMessagePreview: "First",
        },
      ],
      {
        id: "session-2",
        customerName: "Guest A2",
        isOnline: true,
        status: "open" as const,
        unreadCount: 3,
        createdAt: "2026-06-22T08:00:00.000Z",
        updatedAt: "2026-06-22T08:04:00.000Z",
        lastMessagePreview: "Most recent",
      },
    );

    expect(pickNextSessionId(nextSessions, "missing")).toBe("session-2");
  });

  it("appends messages into the correct session transcript", () => {
    const nextRecord = appendMessage(
      {
        "session-1": [
          {
            id: "message-1",
            sessionId: "session-1",
            sender: "customer",
            text: "Hello",
            reactions: [],
            deleted: false,
            timestamp: "2026-06-22T08:00:00.000Z",
          },
        ],
      },
      {
        id: "message-2",
        sessionId: "session-1",
        sender: "agent",
        text: "Hi there",
        reactions: [],
        deleted: false,
        timestamp: "2026-06-22T08:01:00.000Z",
      },
    );

    expect(nextRecord["session-1"]).toHaveLength(2);
    expect(nextRecord["session-1"][1]?.text).toBe("Hi there");
  });
});
