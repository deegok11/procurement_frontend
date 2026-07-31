import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { chatApi } from "../api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface ChatContextValue {
  sessionId: string | null;
  messages: ChatMessage[];
  // The composer's draft text — lives here (not in ChatPanel) so a half-typed
  // message also survives switching tabs and coming back, same as history.
  input: string;
  setInput: (text: string) => void;
  sending: boolean;
  error: string | null;
  // Idempotent — creates a session only the first time it's called (per
  // authenticated session), regardless of how many times ChatPage mounts.
  ensureSession: () => void;
  // Reads `input` itself and clears it as part of sending — the caller
  // doesn't pass the text separately, there's only one place it lives now.
  sendMessage: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creatingRef = useRef(false); // guards StrictMode's double-invoked mount effect

  // ChatProvider sits inside AuthProvider in the tree, but AuthProvider
  // always renders its children — it never conditionally unmounts them based
  // on `user`, so ChatProvider itself never unmounts on logout (only the
  // *routes*, further down, get redirected via ProtectedRoute). Without this,
  // chat history would silently survive a logout and be visible to whoever
  // logs in next on the same browser. Reset explicitly whenever `user` drops
  // to null instead of relying on an unmount that was never going to happen.
  useEffect(() => {
    if (user) return;
    setSessionId(null);
    setMessages([]);
    setInput("");
    setSending(false);
    setError(null);
    creatingRef.current = false;
  }, [user]);

  const ensureSession = useCallback(() => {
    if (sessionId || creatingRef.current) return;
    creatingRef.current = true;
    chatApi
      .createChatSession()
      .then((s) => setSessionId(s.session_id))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to start chat session"))
      .finally(() => {
        creatingRef.current = false;
      });
  }, [sessionId]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setSending(true);
    try {
      const res = await chatApi.sendChatMessage(sessionId, trimmed);
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [sessionId, input]);

  const value = useMemo(
    () => ({ sessionId, messages, input, setInput, sending, error, ensureSession, sendMessage }),
    [sessionId, messages, input, sending, error, ensureSession, sendMessage],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
