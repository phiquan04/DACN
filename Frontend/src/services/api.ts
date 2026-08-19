
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface UserProfile {
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  facebook_link?: string;
  instagram_link?: string;
  country?: string;
  city?: string;
  avatar_url?: string;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  facebook_link?: string;
  instagram_link?: string;
  country?: string;
  city?: string;
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
    headers: { "Authorization": `Bearer ${token}` },
  });
  
  if (!res.ok) {
    // Token is invalid, clear it
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    return null;
  }
  
  return res.json();
}

export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getUserProfile(): Promise<UserProfile> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/user/profile`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to fetch user profile");
  }

  return res.json();
}

export async function updateUserProfile(data: UserProfileUpdate): Promise<UserProfile> {
  console.log("Sending update:", data);
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/user/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to update profile");
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

export function getStoredUser(): User | null {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
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

export interface DictionaryDefinition {
  meaning: string;
  pos: string;
}

export interface DictionaryResult {
  word: string;
  reading: string;
  definitions: Array<{ meaning: string; pos: string }>;
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
}

export interface SearchHistoryItem {
  id: number;
  word: string;
  reading: string;
  meaning: string;
  definitions: Array<{ meaning: string; pos: string }>;
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
  created_at: string;
}

export async function lookupWord(word: string): Promise<DictionaryResult> {
  const res = await fetch(`${BASE_URL}/api/dictionary/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Dictionary lookup failed");
  }
  return res.json();
}

export async function fetchExamples(word: string): Promise<{ japanese: string; vietnamese: string }[]> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/dictionary/examples/${encodeURIComponent(word)}`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load examples");
  }
  return res.json();
}

export async function fetchSynonyms(word: string): Promise<string[]> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/dictionary/synonyms/${encodeURIComponent(word)}`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to load synonyms");
  }
  return res.json();
}

// ---------- Search History ----------
export async function saveSearchHistory(params: {
  userId: number;
  word: string;
  reading?: string;
  meaning?: string;
  definitions?: Array<{ meaning: string; pos: string }>;
  examples?: Array<{ japanese: string; vietnamese: string }>;
  synonyms?: string[];
  jlpt?: string;
  frequency?: string;
}): Promise<void> {
  const token = getToken();
  await fetch(`${BASE_URL}/api/dictionary/history/save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
    body: JSON.stringify({
      user_id: params.userId,
      word: params.word,
      reading: params.reading ?? "",
      meaning: params.meaning ?? "",
      definitions: params.definitions ?? [],
      examples: params.examples ?? [],
      synonyms: params.synonyms ?? [],
      jlpt: params.jlpt ?? "",
      frequency: params.frequency ?? "",
    }),
  });
  // Silently ignore errors — history save is best-effort
}

export async function fetchSearchHistory(userId: number): Promise<SearchHistoryItem[]> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/dictionary/history/${userId}`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteHistoryItem(userId: number, historyId: number): Promise<void> {
  const token = getToken();
  await fetch(`${BASE_URL}/api/dictionary/history/${userId}/${historyId}`, {
    method: "DELETE",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
}

export async function clearHistory(userId: number): Promise<void> {
  const token = getToken();
  await fetch(`${BASE_URL}/api/dictionary/history/${userId}`, {
    method: "DELETE",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
}

export async function fetchHistoryWords(userId: number): Promise<{ word: string; reading: string; meaning: string }[]> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/dictionary/history/words/${userId}`, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
  });
  if (!res.ok) return [];
  return res.json();
}