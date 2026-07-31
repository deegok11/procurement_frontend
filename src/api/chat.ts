import { apiRequest } from "./client";

export function createChatSession(): Promise<{ session_id: string }> {
  return apiRequest<{ session_id: string }>("/chat/sessions", { method: "POST" });
}

export function sendChatMessage(sessionId: string, message: string): Promise<{ reply: string }> {
  return apiRequest<{ reply: string }>(`/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    body: { message },
  });
}
