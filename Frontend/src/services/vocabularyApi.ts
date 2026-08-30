import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import { JlptLevel } from "./jlptApi";

export type { JlptLevel };

// ---------- Lookups: curriculum (bộ giáo trình) & category (danh mục) ----------

export interface Curriculum {
  id: number;
  name: string;
  description?: string | null;
  set_count: number;
}

export async function fetchCurriculums(): Promise<Curriculum[]> {
  return request(`/api/vocabulary/curriculums`, { headers: authHeaders(getToken()) });
}

export async function createCurriculum(payload: { name: string; description?: string | null }): Promise<Curriculum> {
  return request(`/api/vocabulary/curriculums`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function updateCurriculum(
  id: number,
  payload: { name?: string; description?: string | null }
): Promise<Curriculum> {
  return request(`/api/vocabulary/curriculums/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteCurriculum(id: number): Promise<void> {
  await request(`/api/vocabulary/curriculums/${id}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export interface VocabCategory {
  id: number;
  name: string;
  slug: string;
  set_count: number;
}

export async function fetchCategories(): Promise<VocabCategory[]> {
  return request(`/api/vocabulary/categories`, { headers: authHeaders(getToken()) });
}

export async function createCategory(payload: { name: string }): Promise<VocabCategory> {
  return request(`/api/vocabulary/categories`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function updateCategory(id: number, payload: { name?: string }): Promise<VocabCategory> {
  return request(`/api/vocabulary/categories/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  await request(`/api/vocabulary/categories/${id}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// ---------- Import (admin) ----------

export interface ImportVocabularySetResult {
  set_id: number;
  set_name: string;
  level: string;
  status: string;
  item_count: number;
  ai_generated_count: number;
  skipped_count: number;
  failed_batch_count: number;
}

export async function importVocabularySet(params: {
  level: JlptLevel;
  setName: string;
  description?: string;
  curriculumId?: number | null;
  categoryId?: number | null;
  file: File;
}): Promise<ImportVocabularySetResult> {
  const form = new FormData();
  form.append("level", params.level);
  form.append("set_name", params.setName);
  if (params.description) form.append("description", params.description);
  if (params.curriculumId) form.append("curriculum_id", String(params.curriculumId));
  if (params.categoryId) form.append("category_id", String(params.categoryId));
  form.append("file", params.file);

  return request(`/api/vocabulary/sets/import`, {
    method: "POST",
    headers: authHeaders(getToken()),
    body: form,
  });
}

// ---------- Review (admin) ----------

export interface VocabularySetSummary {
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

export interface VocabularyItem {
  id: number;
  order_no: number;
  word: string;
  reading?: string | null;
  han_viet?: string | null;
  meaning_vi: string;
  word_type?: string | null;
  example_sentence_ja?: string | null;
  example_sentence_vi?: string | null;
  admin_notes?: string | null;
  is_meaning_ai_generated: boolean;
  is_example_ai_generated: boolean;
  is_reviewed: boolean;
}

export interface VocabularySetReview extends VocabularySetSummary {
  items: VocabularyItem[];
  ready_to_publish: boolean;
}

export interface VocabularySetPatch {
  set_name?: string;
  description?: string | null;
  curriculum_id?: number | null;
  category_id?: number | null;
  is_locked?: boolean;
}

export async function updateVocabularySet(setId: number, patch: VocabularySetPatch): Promise<VocabularySetSummary> {
  return request(`/api/vocabulary/sets/${setId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(patch),
  });
}

export async function fetchVocabularySets(params?: {
  level?: JlptLevel;
  status?: string;
  curriculumId?: number;
  categoryId?: number;
}): Promise<VocabularySetSummary[]> {
  const query = new URLSearchParams();
  if (params?.level) query.set("level", params.level);
  if (params?.status) query.set("status", params.status);
  if (params?.curriculumId) query.set("curriculum_id", String(params.curriculumId));
  if (params?.categoryId) query.set("category_id", String(params.categoryId));
  const qs = query.toString();
  return request(`/api/vocabulary/sets${qs ? `?${qs}` : ""}`, { headers: authHeaders(getToken()) });
}

export async function fetchVocabularySetReview(setId: number): Promise<VocabularySetReview> {
  return request(`/api/vocabulary/sets/${setId}`, { headers: authHeaders(getToken()) });
}

export interface VocabularyItemPatch {
  word?: string;
  reading?: string | null;
  han_viet?: string | null;
  meaning_vi?: string;
  word_type?: string | null;
  example_sentence_ja?: string | null;
  example_sentence_vi?: string | null;
  admin_notes?: string | null;
  is_reviewed?: boolean;
}

export async function updateVocabularyItem(
  setId: number,
  itemId: number,
  patch: VocabularyItemPatch
): Promise<VocabularyItem> {
  return request(`/api/vocabulary/sets/${setId}/items/${itemId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(patch),
  });
}

export interface VocabularyItemCreate {
  word: string;
  reading?: string | null;
  han_viet?: string | null;
  meaning_vi: string;
  word_type?: string | null;
  example_sentence_ja?: string | null;
  example_sentence_vi?: string | null;
  admin_notes?: string | null;
}

export async function createVocabularyItem(setId: number, payload: VocabularyItemCreate): Promise<VocabularyItem> {
  return request(`/api/vocabulary/sets/${setId}/items`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteVocabularyItem(setId: number, itemId: number): Promise<void> {
  await request(`/api/vocabulary/sets/${setId}/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function markAllVocabularyItemsReviewed(setId: number): Promise<VocabularySetSummary> {
  return request(`/api/vocabulary/sets/${setId}/items/mark-all-reviewed`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function publishVocabularySet(setId: number): Promise<VocabularySetSummary> {
  return request(`/api/vocabulary/sets/${setId}/publish`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function deleteVocabularySet(setId: number): Promise<void> {
  await request(`/api/vocabulary/sets/${setId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}
