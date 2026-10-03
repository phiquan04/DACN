import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import type { ModerationStatus } from "./dictionaryApi";

export type { ModerationStatus };

export type DictionarySortOrder = "newest" | "score_asc" | "score_desc";

export interface AdminDictionaryImageItem {
  id: number;
  word: string;
  image_url: string;
  caption: string;
  status: ModerationStatus;
  uploaded_by: number;
  uploader_username: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
}

export interface AdminDictionaryCommentItem {
  id: number;
  word: string;
  content: string;
  status: ModerationStatus;
  user_id: number;
  username: string;
  upvotes: number;
  downvotes: number;
  score: number;
  created_at: string;
}

export interface AdminDictionaryListPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminDictionaryStats {
  total_content: number;
  pending_count: number;
  today_count: number;
  high_downvote_count: number;
}

interface ListParams {
  search?: string;
  status?: ModerationStatus | "";
  sort?: DictionarySortOrder;
  page: number;
}

function buildQuery(params: ListParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  if (params.sort) q.set("sort", params.sort);
  q.set("page", String(params.page));
  return q.toString();
}

export async function fetchDictionaryStats(): Promise<AdminDictionaryStats> {
  return request(`/api/admin/dictionary/stats`, { headers: authHeaders(getToken()) });
}

export async function fetchAdminImages(params: ListParams): Promise<AdminDictionaryListPage<AdminDictionaryImageItem>> {
  return request(`/api/admin/dictionary/images?${buildQuery(params)}`, { headers: authHeaders(getToken()) });
}

export async function updateImageStatus(imageId: number, status: ModerationStatus): Promise<AdminDictionaryImageItem> {
  return request(`/api/admin/dictionary/images/${imageId}/status`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminImage(imageId: number): Promise<void> {
  await request(`/api/admin/dictionary/images/${imageId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function bulkApproveImages(ids?: number[]): Promise<{ approved_count: number }> {
  return request(`/api/admin/dictionary/images/bulk-approve`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ ids: ids ?? null }),
  });
}

export async function fetchAdminComments(
  params: ListParams
): Promise<AdminDictionaryListPage<AdminDictionaryCommentItem>> {
  return request(`/api/admin/dictionary/comments?${buildQuery(params)}`, { headers: authHeaders(getToken()) });
}

export async function updateCommentStatus(
  commentId: number,
  status: ModerationStatus
): Promise<AdminDictionaryCommentItem> {
  return request(`/api/admin/dictionary/comments/${commentId}/status`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ status }),
  });
}

export async function deleteAdminComment(commentId: number): Promise<void> {
  await request(`/api/admin/dictionary/comments/${commentId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function bulkApproveComments(ids?: number[]): Promise<{ approved_count: number }> {
  return request(`/api/admin/dictionary/comments/bulk-approve`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ ids: ids ?? null }),
  });
}
