import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import type { ScenarioContextField } from "./chatApi";

export type { ScenarioContextField };

export interface AdminScenario {
  id: number;
  title: string;
  description: string | null;
  level: string | null;
  icon: string | null;
  is_active: boolean;
  opening_line: string | null;
  topic_prompt: string | null;
  context_fields: ScenarioContextField[];
}

export interface ScenarioPayload {
  title: string;
  description?: string | null;
  level?: string | null;
  icon?: string | null;
  opening_line?: string | null;
  topic_prompt?: string | null;
  context_fields?: ScenarioContextField[];
}

export interface ScenarioUpdatePayload extends Partial<ScenarioPayload> {
  is_active?: boolean;
}

export async function fetchAdminScenarios(): Promise<AdminScenario[]> {
  return request(`/api/admin/scenarios`, { headers: authHeaders(getToken()) });
}

export async function createScenario(payload: ScenarioPayload): Promise<AdminScenario> {
  return request(`/api/admin/scenarios`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function updateScenario(id: number, payload: ScenarioUpdatePayload): Promise<AdminScenario> {
  return request(`/api/admin/scenarios/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}
