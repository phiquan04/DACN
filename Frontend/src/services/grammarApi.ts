import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface GrammarErrorExplanation {
  original_fragment: string;
  corrected_fragment: string;
  error_type: string;
  why_wrong: string;
  why_fixed: string;
}

export interface CorrectionResult {
  correctedText: string;
  diffs: string[];
  original: string;
  explanation: GrammarErrorExplanation[];
  history_id: number | null;
}

export interface GrammarHistoryItem {
  id: number;
  original_text: string;
  corrected_text: string;
  first_error: GrammarErrorExplanation | null;
  created_at: string;
}

export type GrammarHistoryStatus = "all" | "changed" | "unchanged";

export interface GrammarHistoryPage {
  items: GrammarHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_all: number;
  total_changed: number;
}

export interface GrammarHistoryDetail {
  id: number;
  original_text: string;
  corrected_text: string;
  diffs: string[];
  explanation: GrammarErrorExplanation[];
  alternatives: string[] | null;
  created_at: string;
}

export async function correctGrammar(text: string): Promise<CorrectionResult> {
  return request(`/api/correct`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ text }),
  });
}

export async function fetchAlternatives(text: string, historyId: number | null): Promise<string[]> {
  const data = await request<{ alternatives: string[] }>(`/api/alternative`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ text, history_id: historyId }),
  });
  return data.alternatives;
}

export async function fetchGrammarHistory(
  page: number,
  status: GrammarHistoryStatus = "all"
): Promise<GrammarHistoryPage> {
  return request(`/api/correct/history?page=${page}&status=${status}`, {
    headers: authHeaders(getToken()),
  });
}

export async function fetchGrammarHistoryDetail(id: number): Promise<GrammarHistoryDetail> {
  return request(`/api/correct/history/${id}`, {
    headers: authHeaders(getToken()),
  });
}
