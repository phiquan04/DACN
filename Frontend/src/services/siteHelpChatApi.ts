import { BASE_URL } from "./httpClient";

export interface SiteHelpMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /api/site-help/chat responds as a Server-Sent Events stream (a "chunk"
 * event per reply fragment, then "done", or an "error" event), mirroring
 * streamChatMessage in chatApi.ts — see that file for why this can't go
 * through the shared request() JSON helper.
 */
export async function streamSiteHelpMessage(
  messages: SiteHelpMessage[],
  handlers: {
    onChunk: (text: string) => void;
    onDone: () => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/site-help/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
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
          case "done":
            handlers.onDone();
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
