import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import { JlptLevel } from "./jlptApi";

export type { JlptLevel };

// ---------- Lookups: curriculum (bộ giáo trình) & category (danh mục) ----------

export interface GrammarCurriculum {
  id: number;
  name: string;
  description?: string | null;
  set_count: number;
}

export async function fetchGrammarCurriculums(): Promise<GrammarCurriculum[]> {
  return request(`/api/grammar-content/curriculums`, { headers: authHeaders(getToken()) });
}

export async function createGrammarCurriculum(payload: { name: string; description?: string | null }): Promise<GrammarCurriculum> {
  return request(`/api/grammar-content/curriculums`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function updateGrammarCurriculum(
  id: number,
  payload: { name?: string; description?: string | null }
): Promise<GrammarCurriculum> {
  return request(`/api/grammar-content/curriculums/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteGrammarCurriculum(id: number): Promise<void> {
  await request(`/api/grammar-content/curriculums/${id}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export interface GrammarCategory {
  id: number;
  name: string;
  slug: string;
  set_count: number;
}

export async function fetchGrammarCategories(): Promise<GrammarCategory[]> {
  return request(`/api/grammar-content/categories`, { headers: authHeaders(getToken()) });
}

export async function createGrammarCategory(payload: { name: string }): Promise<GrammarCategory> {
  return request(`/api/grammar-content/categories`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function updateGrammarCategory(id: number, payload: { name?: string }): Promise<GrammarCategory> {
  return request(`/api/grammar-content/categories/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteGrammarCategory(id: number): Promise<void> {
  await request(`/api/grammar-content/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// ---------- Import (admin) ----------

export interface ImportGrammarSetResult {
  set_id: number;
  set_name: string;
  level: string;
  status: string;
  item_count: number;
  ai_generated_count: number;
  skipped_count: number;
  failed_batch_count: number;
}

export async function importGrammarSet(params: {
  level: JlptLevel;
  setName: string;
  description?: string;
  curriculumId?: number | null;
  categoryId?: number | null;
  file: File;
}): Promise<ImportGrammarSetResult> {
  const form = new FormData();
  form.append("level", params.level);
  form.append("set_name", params.setName);
  if (params.description) form.append("description", params.description);
  if (params.curriculumId) form.append("curriculum_id", String(params.curriculumId));
  if (params.categoryId) form.append("category_id", String(params.categoryId));
  form.append("file", params.file);

  return request(`/api/grammar-content/sets/import`, {
    method: "POST",
    headers: authHeaders(getToken()),
    body: form,
  });
}

// ---------- Review (admin) ----------

export interface GrammarSetSummary {
  id: number;
  level: string;
  set_name: string;
  description?: string | null;
  status: "draft" | "processing" | "failed" | "published";
  is_locked: boolean;
  curriculum_id?: number | null;
  curriculum_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  source_filename?: string | null;
  error_message?: string | null;
  item_count: number;
  reviewed_count: number;
  created_at: string;
  updated_at: string;
}

export interface GrammarExample {
  japanese: string;
  vietnamese: string;
}

export interface GrammarPoint {
  id: number;
  order_no: number;
  pattern: string;
  meaning_vi: string;
  usage_note?: string | null;
  examples: GrammarExample[];
  admin_notes?: string | null;
  is_meaning_ai_generated: boolean;
  is_example_ai_generated: boolean;
  is_reviewed: boolean;
}

export interface GrammarSetReview extends GrammarSetSummary {
  items: GrammarPoint[];
  ready_to_publish: boolean;
}

export interface GrammarSetPatch {
  set_name?: string;
  description?: string | null;
  curriculum_id?: number | null;
  category_id?: number | null;
  is_locked?: boolean;
}

export async function updateGrammarSet(setId: number, patch: GrammarSetPatch): Promise<GrammarSetSummary> {
  return request(`/api/grammar-content/sets/${setId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(patch),
  });
}

export async function fetchGrammarSets(params?: {
  level?: JlptLevel;
  status?: string;
  curriculumId?: number;
  categoryId?: number;
}): Promise<GrammarSetSummary[]> {
  const query = new URLSearchParams();
  if (params?.level) query.set("level", params.level);
  if (params?.status) query.set("status", params.status);
  if (params?.curriculumId) query.set("curriculum_id", String(params.curriculumId));
  if (params?.categoryId) query.set("category_id", String(params.categoryId));
  const qs = query.toString();
  return request(`/api/grammar-content/sets${qs ? `?${qs}` : ""}`, { headers: authHeaders(getToken()) });
}

export async function fetchGrammarSetReview(setId: number): Promise<GrammarSetReview> {
  return request(`/api/grammar-content/sets/${setId}`, { headers: authHeaders(getToken()) });
}

export interface GrammarPointPatch {
  pattern?: string;
  meaning_vi?: string;
  usage_note?: string | null;
  examples?: GrammarExample[];
  admin_notes?: string | null;
  is_reviewed?: boolean;
}

export async function updateGrammarPoint(
  setId: number,
  itemId: number,
  patch: GrammarPointPatch
): Promise<GrammarPoint> {
  return request(`/api/grammar-content/sets/${setId}/items/${itemId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(patch),
  });
}

export interface GrammarPointCreate {
  pattern: string;
  meaning_vi: string;
  usage_note?: string | null;
  examples?: GrammarExample[];
  admin_notes?: string | null;
}

export async function createGrammarPoint(setId: number, payload: GrammarPointCreate): Promise<GrammarPoint> {
  return request(`/api/grammar-content/sets/${setId}/items`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteGrammarPoint(setId: number, itemId: number): Promise<void> {
  await request(`/api/grammar-content/sets/${setId}/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function markAllGrammarPointsReviewed(setId: number): Promise<GrammarSetSummary> {
  return request(`/api/grammar-content/sets/${setId}/items/mark-all-reviewed`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function publishGrammarSet(setId: number): Promise<GrammarSetSummary> {
  return request(`/api/grammar-content/sets/${setId}/publish`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function deleteGrammarSet(setId: number): Promise<void> {
  await request(`/api/grammar-content/sets/${setId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// ---------- Library (learner-facing, published sets only) ----------

export interface GrammarSetDetail extends GrammarSetSummary {
  items: GrammarPoint[];
}

export async function fetchPublishedGrammarSets(params?: {
  level?: JlptLevel;
  curriculumId?: number;
  categoryId?: number;
}): Promise<GrammarSetSummary[]> {
  const query = new URLSearchParams();
  if (params?.level) query.set("level", params.level);
  if (params?.curriculumId) query.set("curriculum_id", String(params.curriculumId));
  if (params?.categoryId) query.set("category_id", String(params.categoryId));
  const qs = query.toString();
  return request(`/api/grammar-content/library/sets${qs ? `?${qs}` : ""}`, { headers: authHeaders(getToken()) });
}

export async function fetchPublishedGrammarSet(setId: number): Promise<GrammarSetDetail> {
  return request(`/api/grammar-content/library/sets/${setId}`, { headers: authHeaders(getToken()) });
}

// ---------- Practice (learner-facing, auto-graded cloze/mcq exercises) ----------

export interface GrammarExerciseItem {
  id: number;
  grammar_point_id: number;
  grammar_pattern: string;
  type: "cloze" | "mcq";
  prompt: string;
  choices: string[] | null;
}

export interface SubmitGrammarAnswerResult {
  correct: boolean;
  correct_answer: string;
  grammar_point_id: number;
  status: "new" | "reviewing" | "learned";
  due_at?: string | null;
}

export async function fetchDueGrammarExercises(params?: {
  limit?: number;
  setId?: number;
}): Promise<GrammarExerciseItem[]> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.setId) query.set("set_id", String(params.setId));
  const qs = query.toString();
  return request(`/api/grammar-content/practice/due${qs ? `?${qs}` : ""}`, { headers: authHeaders(getToken()) });
}

export async function submitGrammarExerciseAnswer(
  exerciseId: number,
  answer: string
): Promise<SubmitGrammarAnswerResult> {
  return request(`/api/grammar-content/practice/exercises/${exerciseId}/submit`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ answer }),
  });
}
