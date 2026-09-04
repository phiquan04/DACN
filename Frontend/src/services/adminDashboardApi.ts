import { authHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface LevelDistributionItem {
  level: string;
  count: number;
  percent: number;
}

export interface ActivityPoint {
  iso_date: string;
  new_users: number;
}

export type ActionItemKind = "vocabulary_set" | "jlpt_exam" | "chat_scenario";

export interface ActionItem {
  kind: ActionItemKind;
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  created_at: string;
}

export interface ResourceBar {
  label: string;
  current: number;
  total: number;
}

export interface AdminOverview {
  total_users: number;
  new_users_7d: number;
  active_users_7d: number;
  pending_vocabulary_sets: number;
  pending_jlpt_exams: number;
  chats_today: number;
  level_distribution: LevelDistributionItem[];
  activity_last_7_days: ActivityPoint[];
  action_items: ActionItem[];
  resources: ResourceBar[];
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return request("/api/admin/dashboard/overview", { headers: authHeaders(getToken()) });
}
