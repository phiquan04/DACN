import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  locked_reason?: string | null;
  locked_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  current_jlpt_level?: string | null;
}

export interface AdminUserListPage {
  items: AdminUserSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUserDetail extends AdminUserSummary {
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  target_jlpt_level?: string | null;
  streak_days: number;
  last_activity_at?: string | null;
  total_study_minutes: number;
  vocab_xp: number;
  level: number;
  level_xp_floor: number;
  level_xp_ceil: number;
  daily_vocab_goal?: number | null;
  profile_updated_at?: string | null;
}

export type UserRoleFilter = "admin" | "user" | "";
export type UserStatusFilter = "active" | "locked" | "";

export interface FetchUsersParams {
  search?: string;
  role?: UserRoleFilter;
  status?: UserStatusFilter;
  page?: number;
}

export async function fetchUsers(params: FetchUsersParams = {}): Promise<AdminUserListPage> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);
  qs.set("page", String(params.page ?? 1));
  return request(`/api/admin/users?${qs.toString()}`, { headers: authHeaders(getToken()) });
}

export async function fetchUserDetail(id: number): Promise<AdminUserDetail> {
  return request(`/api/admin/users/${id}`, { headers: authHeaders(getToken()) });
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: "admin" | "user";
  first_name?: string;
  last_name?: string;
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUserDetail> {
  return request(`/api/admin/users`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export interface UpdateUserPayload {
  role?: "admin" | "user";
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  current_jlpt_level?: string | null;
  target_jlpt_level?: string | null;
  daily_vocab_goal?: number | null;
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<AdminUserDetail> {
  return request(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function resetUserPassword(id: number): Promise<{ temporary_password: string }> {
  return request(`/api/admin/users/${id}/reset-password`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function lockUser(id: number, reason: string): Promise<AdminUserDetail> {
  return request(`/api/admin/users/${id}/lock`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ reason }),
  });
}

export async function unlockUser(id: number): Promise<AdminUserDetail> {
  return request(`/api/admin/users/${id}/unlock`, {
    method: "PATCH",
    headers: authHeaders(getToken()),
  });
}
