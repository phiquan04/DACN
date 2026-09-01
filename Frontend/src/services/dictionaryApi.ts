import { BASE_URL, authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface DictionaryDefinition {
  meaning: string;
  pos: string;
  pos_label?: string;
}

export interface KanjiInfo {
  literal: string;
  on_yomi: string[];
  kun_yomi: string[];
  hanviet: string[];
  meaning: string;
  stroke_count: number | null;
  jlpt: string | null;
  grade: string | null;
}

export interface DictionaryResult {
  word: string;
  reading: string;
  definitions: DictionaryDefinition[];
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
  kanji: KanjiInfo[];
}

export interface SearchHistoryItem {
  id: number;
  word: string;
  reading: string;
  meaning: string;
  definitions: DictionaryDefinition[];
  examples: Array<{ japanese: string; vietnamese: string }>;
  synonyms: string[];
  jlpt: string;
  frequency: string;
  kanji: KanjiInfo[];
  created_at: string;
}

export async function lookupWord(word: string): Promise<DictionaryResult> {
  return request(`/api/dictionary/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
}

/** strokes: one array of [x, y] points per stroke, in drawing order. */
export async function recognizeHandwriting(strokes: number[][][]): Promise<string[]> {
  const res = await request<{ candidates: string[] }>(`/api/dictionary/handwriting/recognize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ strokes }),
  });
  return res.candidates;
}

export function getPronunciationAudioUrl(text: string): string {
  return `${BASE_URL}/api/dictionary/audio?text=${encodeURIComponent(text)}`;
}

export async function fetchExamples(word: string): Promise<{ japanese: string; vietnamese: string }[]> {
  const token = getToken();
  return request(`/api/dictionary/examples/${encodeURIComponent(word)}`, {
    headers: authHeaders(token),
  });
}

export async function fetchSynonyms(word: string): Promise<string[]> {
  const token = getToken();
  return request(`/api/dictionary/synonyms/${encodeURIComponent(word)}`, {
    headers: authHeaders(token),
  });
}

// ---------- Search History ----------
// These calls back non-critical, best-effort data (search history bookkeeping):
// failures are swallowed and reported silently so they never interrupt the
// dictionary lookup flow the user actually cares about.
export async function saveSearchHistory(params: {
  userId: number;
  word: string;
  reading?: string;
  meaning?: string;
  definitions?: DictionaryDefinition[];
  examples?: Array<{ japanese: string; vietnamese: string }>;
  synonyms?: string[];
  jlpt?: string;
  frequency?: string;
  kanji?: KanjiInfo[];
}): Promise<void> {
  const token = getToken();
  try {
    await request(`/api/dictionary/history/save`, {
      method: "POST",
      headers: jsonHeaders(token),
      silent: true,
      body: JSON.stringify({
        user_id: params.userId,
        word: params.word,
        reading: params.reading ?? "",
        meaning: params.meaning ?? "",
        definitions: params.definitions ?? [],
        examples: params.examples ?? [],
        synonyms: params.synonyms ?? [],
        jlpt: params.jlpt ?? "",
        frequency: params.frequency ?? "",
        kanji: params.kanji ?? [],
      }),
    });
  } catch {
    // best-effort — history save failures shouldn't surface to the user
  }
}

export async function fetchSearchHistory(userId: number): Promise<SearchHistoryItem[]> {
  try {
    return await request<SearchHistoryItem[]>(`/api/dictionary/history/${userId}`, {
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    return [];
  }
}

export async function deleteHistoryItem(userId: number, historyId: number): Promise<void> {
  try {
    await request(`/api/dictionary/history/${userId}/${historyId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function clearHistory(userId: number): Promise<void> {
  try {
    await request(`/api/dictionary/history/${userId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function fetchHistoryWords(userId: number): Promise<{ word: string; reading: string; meaning: string }[]> {
  try {
    return await request(`/api/dictionary/history/words/${userId}`, {
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    return [];
  }
}

// ---------- Community images ----------
export interface DictionaryImageItem {
  id: number;
  image_url: string;
  caption: string;
  uploaded_by: number;
  uploader_username: string;
  created_at: string;
}

export async function fetchImages(word: string): Promise<DictionaryImageItem[]> {
  try {
    return await request(`/api/dictionary/images/${encodeURIComponent(word)}`, { silent: true });
  } catch {
    return [];
  }
}

export async function uploadImage(params: {
  word: string;
  file: File;
  caption?: string;
}): Promise<DictionaryImageItem> {
  const formData = new FormData();
  formData.append("word", params.word);
  formData.append("caption", params.caption ?? "");
  formData.append("file", params.file);

  return request(`/api/dictionary/images`, {
    method: "POST",
    headers: authHeaders(getToken()),
    body: formData,
  });
}

export async function deleteImage(imageId: number): Promise<void> {
  try {
    await request(`/api/dictionary/images/${imageId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

// ---------- Community comments ----------
export interface DictionaryCommentItem {
  id: number;
  word: string;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  content: string;
  upvotes: number;
  downvotes: number;
  my_vote: "up" | "down" | null;
  created_at: string;
}

export async function fetchComments(word: string, userId?: number): Promise<DictionaryCommentItem[]> {
  const query = userId ? `?user_id=${userId}` : "";
  try {
    return await request(`/api/dictionary/comments/${encodeURIComponent(word)}${query}`, { silent: true });
  } catch {
    return [];
  }
}

export async function postComment(params: {
  word: string;
  content: string;
}): Promise<DictionaryCommentItem> {
  return request(`/api/dictionary/comments`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ word: params.word, content: params.content }),
  });
}

export async function deleteComment(commentId: number): Promise<void> {
  try {
    await request(`/api/dictionary/comments/${commentId}`, {
      method: "DELETE",
      headers: authHeaders(getToken()),
      silent: true,
    });
  } catch {
    // best-effort
  }
}

export async function voteComment(
  commentId: number,
  voteType: "up" | "down"
): Promise<DictionaryCommentItem> {
  return request(`/api/dictionary/comments/${commentId}/vote`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ vote_type: voteType }),
  });
}
