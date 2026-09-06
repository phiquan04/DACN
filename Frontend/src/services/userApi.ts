import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface UserProfile {
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  city?: string;
  avatar_url?: string;
  date_of_birth?: string;
  gender?: string;
  current_jlpt_level?: string;
  target_jlpt_level?: string;
}

export interface UserProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone?: string;
  country?: string;
  city?: string;
  date_of_birth?: string | null;
  gender?: string | null;
  current_jlpt_level?: string | null;
  target_jlpt_level?: string | null;
  /** Not a real PUT /profile field (avatar has its own upload/delete endpoints) —
   * accepted here only so UserMetaCard can hand the freshly-uploaded URL back
   * through the same onSave callback to update the parent's cached profile. */
  avatar_url?: string;
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

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = getToken();
  await request(`/api/user/password`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export interface ReminderSettings {
  enabled: boolean;
  /** "HH:MM:SS" time-of-day strings, at most 5. */
  times: string[];
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  const token = getToken();
  return request(`/api/user/reminder-settings`, {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function updateReminderSettings(data: ReminderSettings): Promise<ReminderSettings> {
  const token = getToken();
  return request(`/api/user/reminder-settings`, {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify(data),
  });
}
