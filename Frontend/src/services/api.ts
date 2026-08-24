
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ErrorReporter = (message: string) => void;
let errorReporter: ErrorReporter | null = null;

/** Wires a global handler (e.g. a toast) that fires whenever a non-silent API call fails. */
export function setApiErrorReporter(reporter: ErrorReporter | null): void {
  errorReporter = reporter;
}

interface RequestOptions extends RequestInit {
  /** Skip the global error reporter — use for best-effort/background calls. */
  silent?: boolean;
}

/**
 * Shared fetch wrapper: every API call goes through here so failures are
 * parsed and reported consistently instead of each function re-implementing
 * its own ad-hoc error handling.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { silent, ...init } = options;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    const message = "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.";
    if (!silent) errorReporter?.(message);
    throw new ApiError(message, 0);
  }

  if (!res.ok) {
    let message = `Yêu cầu thất bại (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.error || message;
    } catch {
      // response body wasn't JSON — keep the default message
    }
    if (!silent) errorReporter?.(message);
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(token: string | null): HeadersInit {
  return { "Content-Type": "application/json", ...authHeaders(token) };
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  role: string;
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
  feedback?: string | null;
  isOffTopic?: boolean;
}

export interface ChatStreamMeta {
  feedback: string | null;
  is_off_topic: boolean;
  suggestions: string[];
  message_id: number;
  conversation_id: number;
}

export interface ChatScenario {
  id: number;
  title: string;
  description: string | null;
  level: string | null;
  icon: string | null;
}

export interface StartConversationResponse {
  conversation_id: number;
  scenario_id: number | null;
  opening_message: { id: number; role: "assistant"; content: string } | null;
}

export interface TTSResponse {
  text: string;
  duration_ms: number;
  lipsync_keyframes: Array<{ time_ms: number; mouth_open: number }>;
  tts_method: string;
}

export async function signUp(data: SignUpRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  return response;
}

export async function signIn(data: SignInRequest): Promise<AuthResponse> {
  const response = await request<AuthResponse>("/api/auth/signin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  localStorage.setItem("access_token", response.access_token);
  localStorage.setItem("user", JSON.stringify(response.user));
  return response;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;

  // An expired/invalid token isn't an application error worth a toast —
  // it just means the user is signed out, so this bypasses the shared
  // request() helper and its global error reporting.
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
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
  return request(`/api/user/avatar`, {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function deleteAvatar(): Promise<{ avatar_url: null }> {
  const token = getToken();
  return request(`/api/user/avatar`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getUserProfile(): Promise<UserProfile> {
  const token = getToken();
  return request(`/api/user/profile`, {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function updateUserProfile(data: UserProfileUpdate): Promise<UserProfile> {
  const token = getToken();
  return request(`/api/user/profile`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
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

export async function fetchScenarios(): Promise<ChatScenario[]> {
  try {
    return await request<ChatScenario[]>(`/api/scenarios`, { silent: true });
  } catch {
    return [];
  }
}

export async function startConversation(
  scenarioId?: number
): Promise<StartConversationResponse> {
  const token = getToken();
  return request(`/api/conversations`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ scenario_id: scenarioId ?? null }),
  });
}

/**
 * POST /api/chat now responds as a Server-Sent Events stream (a "chunk"
 * event per reply fragment, then one "meta" event with feedback/suggestions,
 * or an "error" event) instead of a single JSON body, so it can't go
 * through the shared request() JSON helper — it reads the response body
 * itself and invokes the matching handler as each event arrives.
 */
export async function streamChatMessage(
  conversationId: number,
  message: string,
  handlers: {
    onChunk: (text: string) => void;
    onMeta: (meta: ChatStreamMeta) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ conversation_id: conversationId, message }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError("Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.");
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Yêu cầu thất bại (${res.status})`;
    try {
      const body = await res.json();
      msg = body.detail || body.error || msg;
    } catch {
      // response body wasn't JSON — keep the default message
    }
    handlers.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        const eventMatch = rawEvent.match(/^event: (.+)$/m);
        const dataMatch = rawEvent.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataMatch[1]);
        } catch {
          continue;
        }

        switch (eventMatch[1].trim()) {
          case "chunk":
            handlers.onChunk((payload.text as string) ?? "");
            break;
          case "meta":
            handlers.onMeta(payload as unknown as ChatStreamMeta);
            break;
          case "error":
            handlers.onError((payload.detail as string) || "Đã xảy ra lỗi khi trò chuyện.");
            break;
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    handlers.onError("Kết nối bị gián đoạn. Vui lòng thử lại.");
  }
}

export async function getTTSData(text: string): Promise<TTSResponse> {
  const token = getToken();
  return request(`/api/tts`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ text }),
  });
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
  pos_label?: string;
}

export interface KanjiInfo {
  literal: string;
  on_yomi: string[];
  kun_yomi: string[];
  hanviet: string[];
  meaning: string;
  stroke_count: number | null;
  jlpt: string | null;
  grade: string | null;
}

export interface DictionaryResult {
  word: string;
  reading: string;
  definitions: DictionaryDefinition[];
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
  kanji: KanjiInfo[];
}

export interface SearchHistoryItem {
  id: number;
  word: string;
  reading: string;
  meaning: string;
  definitions: DictionaryDefinition[];
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
  created_at: string;
}

export async function lookupWord(word: string): Promise<DictionaryResult> {
  return request(`/api/dictionary/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
}

export function getPronunciationAudioUrl(text: string): string {
  return `${BASE_URL}/api/dictionary/audio?text=${encodeURIComponent(text)}`;
}

export async function fetchExamples(word: string): Promise<{ japanese: string; vietnamese: string }[]> {
  const token = getToken();
  return request(`/api/dictionary/examples/${encodeURIComponent(word)}`, {
    headers: authHeaders(token),
  });
}

export async function fetchSynonyms(word: string): Promise<string[]> {
  const token = getToken();
  return request(`/api/dictionary/synonyms/${encodeURIComponent(word)}`, {
    headers: authHeaders(token),
  });
}

// ---------- Search History ----------
// These calls back non-critical, best-effort data (search history bookkeeping):
// failures are swallowed and reported silently so they never interrupt the
// dictionary lookup flow the user actually cares about.
export async function saveSearchHistory(params: {
  userId: number;
  word: string;
  reading?: string;
  meaning?: string;
  definitions?: DictionaryDefinition[];
  examples?: Array<{ japanese: string; vietnamese: string }>;
  synonyms?: string[];
  jlpt?: string;
  frequency?: string;
}): Promise<void> {
  const token = getToken();
  try {
    await request(`/api/dictionary/history/save`, {
      method: "POST",
      headers: jsonHeaders(token),
      silent: true,
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
  } catch {
    // best-effort — history save failures shouldn't surface to the user
  }
}

export async function fetchSearchHistory(userId: number): Promise<SearchHistoryItem[]> {
  try {
    return await request<SearchHistoryItem[]>(`/api/dictionary/history/${userId}`, {
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    return [];
  }
}

export async function deleteHistoryItem(userId: number, historyId: number): Promise<void> {
  try {
    await request(`/api/dictionary/history/${userId}/${historyId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function clearHistory(userId: number): Promise<void> {
  try {
    await request(`/api/dictionary/history/${userId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function fetchHistoryWords(userId: number): Promise<{ word: string; reading: string; meaning: string }[]> {
  try {
    return await request(`/api/dictionary/history/words/${userId}`, {
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    return [];
  }
}

// ---------- Community images ----------
export interface DictionaryImageItem {
  id: number;
  image_url: string;
  caption: string;
  uploaded_by: number;
  uploader_username: string;
  created_at: string;
}

export async function fetchImages(word: string): Promise<DictionaryImageItem[]> {
  try {
    return await request(`/api/dictionary/images/${encodeURIComponent(word)}`, { silent: true });
  } catch {
    return [];
  }
}

export async function uploadImage(params: {
  word: string;
  userId: number;
  file: File;
  caption?: string;
}): Promise<DictionaryImageItem> {
  const formData = new FormData();
  formData.append("word", params.word);
  formData.append("user_id", String(params.userId));
  formData.append("caption", params.caption ?? "");
  formData.append("file", params.file);

  return request(`/api/dictionary/images`, {
    method: "POST",
    headers: authHeaders(getToken()),
    body: formData,
  });
}

export async function deleteImage(imageId: number, userId: number): Promise<void> {
  try {
    await request(`/api/dictionary/images/${imageId}?user_id=${userId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

// ---------- Community comments ----------
export interface DictionaryCommentItem {
  id: number;
  word: string;
  user_id: number;
  username: string;
  content: string;
  upvotes: number;
  downvotes: number;
  my_vote: "up" | "down" | null;
  created_at: string;
}

export async function fetchComments(word: string, userId?: number): Promise<DictionaryCommentItem[]> {
  const query = userId ? `?user_id=${userId}` : "";
  try {
    return await request(`/api/dictionary/comments/${encodeURIComponent(word)}${query}`, { silent: true });
  } catch {
    return [];
  }
}

export async function postComment(params: {
  word: string;
  userId: number;
  content: string;
}): Promise<DictionaryCommentItem> {
  return request(`/api/dictionary/comments`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ word: params.word, user_id: params.userId, content: params.content }),
  });
}

export async function deleteComment(commentId: number, userId: number): Promise<void> {
  try {
    await request(`/api/dictionary/comments/${commentId}?user_id=${userId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function voteComment(
  commentId: number,
  userId: number,
  voteType: "up" | "down"
): Promise<DictionaryCommentItem> {
  return request(`/api/dictionary/comments/${commentId}/vote`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ user_id: userId, vote_type: voteType }),
  });
}
