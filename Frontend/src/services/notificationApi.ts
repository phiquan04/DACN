import { authHeaders, fetchWithAuthRefresh, request } from "./httpClient";
import { getToken } from "./authApi";

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

const BASE = "/api/notifications";

export async function fetchNotifications(): Promise<AppNotification[]> {
  return request(BASE, { headers: authHeaders(getToken()) });
}

export async function fetchUnreadCount(): Promise<{ unread_count: number }> {
  return request(`${BASE}/unread-count`, { headers: authHeaders(getToken()), silent: true });
}

export async function markNotificationRead(id: number): Promise<AppNotification> {
  return request(`${BASE}/${id}/read`, { method: "POST", headers: authHeaders(getToken()) });
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return request(`${BASE}/read-all`, { method: "POST", headers: authHeaders(getToken()) });
}

export type NotificationStreamEvent =
  | { type: "ready"; unread_count: number }
  | { type: "unread_count"; unread_count: number }
  | { type: "notification"; unread_count: number; notification: AppNotification };

/** How a single stream connection ended — drives the reconnect policy in useNotificationStream. */
export type NotificationStreamOutcome =
  | "aborted" // the caller aborted (component unmounted / signed out)
  | "unauthorized" // 401 even after a token refresh: the session is over, stop retrying
  | "rejected" // any other non-OK status (e.g. 429 too many open streams)
  | "failed" // never connected (network error)
  | "ended"; // was connected, then the server closed it (token re-check, restart) or the network dropped

/**
 * GET /api/notifications/stream is a Server-Sent Events stream that stays
 * open for as long as the tab does: "ready" once, then "notification" /
 * "unread_count" as they happen — every event carries the fresh unread count
 * (see Backend/app/routes/notifications.py). Read with fetch() rather than the
 * browser's EventSource because EventSource can't send the Authorization
 * header; parsing mirrors streamChatMessage in chatApi.ts. Resolves (never
 * rejects) once the connection is over; reconnecting is the caller's job.
 */
export async function openNotificationStream(
  onEvent: (event: NotificationStreamEvent) => void,
  signal: AbortSignal
): Promise<NotificationStreamOutcome> {
  let res: Response;
  try {
    res = await fetchWithAuthRefresh(`${BASE}/stream`, { headers: authHeaders(getToken()), signal });
  } catch {
    return signal.aborted ? "aborted" : "failed";
  }

  if (res.status === 401) return "unauthorized";
  if (!res.ok || !res.body) return "rejected";

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return "ended";
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);

        // Heartbeats (": ping") have neither line and are skipped here.
        const eventMatch = rawEvent.match(/^event: (.+)$/m);
        const dataMatch = rawEvent.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;

        let payload: { unread_count: number; notification?: AppNotification };
        try {
          payload = JSON.parse(dataMatch[1]);
        } catch {
          continue;
        }

        const type = eventMatch[1].trim();
        if (type === "notification" && payload.notification) {
          onEvent({ type, unread_count: payload.unread_count, notification: payload.notification });
        } else if (type === "ready" || type === "unread_count") {
          onEvent({ type, unread_count: payload.unread_count });
        }
      }
    }
  } catch {
    return signal.aborted ? "aborted" : "ended";
  }
}
