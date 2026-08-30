import { authHeaders, request } from "./httpClient";
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
