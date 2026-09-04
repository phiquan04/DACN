import { BASE_URL, authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import type { GrammarErrorExplanation } from "./grammarApi";

export interface GrammarNote {
  corrected_text: string;
  diffs: string[];
  error_count: number;
  has_errors: boolean;
  explanation: GrammarErrorExplanation[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  feedback?: string | null;
  isOffTopic?: boolean;
  streamId?: number;
  grammar?: GrammarNote | null;
}

export interface ChatStreamMeta {
  feedback: string | null;
  is_off_topic: boolean;
  suggestions: string[];
  message_id: number;
  conversation_id: number;
}

export interface MessageDetail {
  id: number;
  role: "user" | "assistant";
  content: string;
  feedback: string | null;
  is_off_topic: boolean;
  grammar: GrammarNote | null;
  created_at: string;
}

export interface ConversationHistoryItem {
  id: number;
  title: string | null;
  scenario_title: string | null;
  scenario_icon: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationHistoryPage {
  items: ConversationHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ConversationDetail {
  id: number;
  title: string | null;
  scenario_id: number | null;
  scenario_title: string | null;
  situation_context: string | null;
  messages: MessageDetail[];
}

export interface ScenarioContextField {
  key: string;
  label: string;
  placeholder?: string | null;
}

export interface ChatScenario {
  id: number;
  title: string;
  description: string | null;
  level: string | null;
  icon: string | null;
  context_fields: ScenarioContextField[];
}

export interface StartConversationResponse {
  conversation_id: number;
  scenario_id: number | null;
  situation_context: string | null;
  opening_message: { id: number; role: "assistant"; content: string } | null;
}

export async function fetchScenarios(): Promise<ChatScenario[]> {
  try {
    return await request<ChatScenario[]>(`/api/scenarios`, { silent: true });
  } catch {
    return [];
  }
}

export async function startConversation(
  scenarioId?: number,
  situationContext?: string
): Promise<StartConversationResponse> {
  const token = getToken();
  return request(`/api/conversations`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      scenario_id: scenarioId ?? null,
      situation_context: situationContext ?? null,
    }),
  });
}

export async function updateSituationContext(
  conversationId: number,
  situationContext: string | null
): Promise<ConversationDetail> {
  const token = getToken();
  return request(`/api/conversations/${conversationId}/situation`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify({ situation_context: situationContext }),
  });
}

export async function fetchConversationHistory(page: number): Promise<ConversationHistoryPage> {
  const token = getToken();
  return request(`/api/conversations?page=${page}`, {
    headers: authHeaders(token),
  });
}

export async function fetchConversationDetail(id: number): Promise<ConversationDetail> {
  const token = getToken();
  return request(`/api/conversations/${id}`, {
    headers: authHeaders(token),
  });
}

/**
 * POST /api/chat now responds as a Server-Sent Events stream (a "chunk"
 * event per reply fragment, then one "meta" event with feedback/suggestions,
 * then one "grammar" event with the grammar note for the user's message, or
 * an "error" event) instead of a single JSON body, so it can't go through the
 * shared request() JSON helper — it reads the response body itself and
 * invokes the matching handler as each event arrives.
 */
export async function streamChatMessage(
  conversationId: number,
  message: string,
  handlers: {
    onChunk: (text: string) => void;
    onMeta: (meta: ChatStreamMeta) => void;
    onGrammar: (grammar: GrammarNote & { message_id: number }) => void;
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
          case "grammar":
            handlers.onGrammar(payload as unknown as GrammarNote & { message_id: number });
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
