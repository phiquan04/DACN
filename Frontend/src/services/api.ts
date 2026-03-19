// src/services/api.ts
// Communicates with the Flask backend

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatResponse {
  reply: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface TTSResponse {
  text: string;
  duration_ms: number;
  lipsync_keyframes: Array<{ time_ms: number; mouth_open: number }>;
  tts_method: string;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chat request failed");
  }
  return res.json();
}

export async function getTTSData(text: string): Promise<TTSResponse> {
  const res = await fetch(`${BASE_URL}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "TTS request failed");
  }
  return res.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}