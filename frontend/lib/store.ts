"use client";
import { create } from "zustand";
import type { ChatMessage, Lead, MessagePayload } from "./types";

let _idCounter = 0;
function nextId() {
  return `msg-${Date.now()}-${++_idCounter}`;
}

interface ChatStore {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedLead: Lead | null;

  addUserMessage: (text: string) => string;
  addAssistantMessage: (payload: MessagePayload) => string;
  addSystemMessage: (text: string) => void;
  updateMessage: (id: string, payload: Partial<MessagePayload>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setLoading: (v: boolean) => void;
  setSelectedLead: (lead: Lead | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  selectedLead: null,

  addUserMessage: (text) => {
    const id = nextId();
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: "user", timestamp: new Date(), payload: { type: "text", text } },
      ],
    }));
    return id;
  },

  addAssistantMessage: (payload) => {
    const id = nextId();
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: "assistant", timestamp: new Date(), payload },
      ],
    }));
    return id;
  },

  addSystemMessage: (text) => {
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: nextId(),
          role: "system",
          timestamp: new Date(),
          payload: { type: "text", text },
        },
      ],
    }));
  },

  updateMessage: (id, payload) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, payload: { ...m.payload, ...payload } } : m
      ),
    }));
  },

  removeMessage: (id) => {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
  },

  clearMessages: () => set({ messages: [] }),

  setLoading: (v) => set({ isLoading: v }),

  setSelectedLead: (lead) => set({ selectedLead: lead }),
}));