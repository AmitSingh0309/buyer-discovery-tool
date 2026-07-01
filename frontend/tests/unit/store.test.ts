import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/lib/store";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isLoading: false, selectedLead: null });
  });

  it("starts with empty messages", () => {
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it("addUserMessage appends a user message", () => {
    useChatStore.getState().addUserMessage("hello");
    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].payload.text).toBe("hello");
  });

  it("addAssistantMessage appends an assistant message", () => {
    useChatStore.getState().addAssistantMessage({ type: "text", text: "Hi!" });
    const msgs = useChatStore.getState().messages;
    expect(msgs[0].role).toBe("assistant");
    expect(msgs[0].payload.type).toBe("text");
  });

  it("addSystemMessage appends a system message", () => {
    useChatStore.getState().addSystemMessage("info");
    expect(useChatStore.getState().messages[0].role).toBe("system");
  });

  it("clearMessages empties the list", () => {
    useChatStore.getState().addUserMessage("a");
    useChatStore.getState().addUserMessage("b");
    useChatStore.getState().clearMessages();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it("updateMessage patches payload", () => {
    const id = useChatStore.getState().addAssistantMessage({ type: "text", text: "old" });
    useChatStore.getState().updateMessage(id, { text: "new" });
    const msg = useChatStore.getState().messages.find((m) => m.id === id);
    expect(msg?.payload.text).toBe("new");
  });

  it("removeMessage removes only the target", () => {
    const id1 = useChatStore.getState().addUserMessage("a");
    useChatStore.getState().addUserMessage("b");
    useChatStore.getState().removeMessage(id1);
    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].payload.text).toBe("b");
  });

  it("setLoading toggles isLoading", () => {
    useChatStore.getState().setLoading(true);
    expect(useChatStore.getState().isLoading).toBe(true);
    useChatStore.getState().setLoading(false);
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it("message ids are unique", () => {
    useChatStore.getState().addUserMessage("a");
    useChatStore.getState().addUserMessage("b");
    const msgs = useChatStore.getState().messages;
    expect(msgs[0].id).not.toBe(msgs[1].id);
  });

  it("each message has a timestamp", () => {
    useChatStore.getState().addUserMessage("test");
    const msg = useChatStore.getState().messages[0];
    expect(msg.timestamp).toBeInstanceOf(Date);
  });
});