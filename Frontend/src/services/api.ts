
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
}

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

export async function signUp(data: SignUpRequest): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Sign up failed");
  }
  
  const response: AuthResponse = await res.json();
  // Store token in localStorage
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  
  return response;
}

export async function signIn(data: SignInRequest): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Sign in failed");
  }
  
  const response: AuthResponse = await res.json();
  // Store token in localStorage
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  
  return response;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!res.ok) {
    // Token is invalid, clear it
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    return null;
  }
  
  return res.json();
}

export function logout(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

export function getToken(): string | null {
  return localStorage.getItem("access_token");
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const token = getToken();
  
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chat request failed");
  }
  return res.json();
}

export async function getTTSData(text: string): Promise<TTSResponse> {
  const token = getToken();
  
  const res = await fetch(`${BASE_URL}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
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