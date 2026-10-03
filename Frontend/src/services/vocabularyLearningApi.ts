import { authHeaders, BASE_URL, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import type { JlptLevel } from "./jlptApi";

export type LearningStatus = "new" | "reviewing" | "learned";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type BatchSource = "sequential" | "review";

export interface VocabularyLearningItem {
  id: number;
  order_no: number;
  word: string;
  reading?: string | null;
  han_viet?: string | null;
  meaning_vi: string;
  word_type?: string | null;
  example_sentence_ja?: string | null;
  example_sentence_vi?: string | null;
  status: LearningStatus;
  is_bookmarked: boolean;
  due_at?: string | null;
}

export interface VocabularySetProgress {
  id: number;
  level: JlptLevel;
  set_name: string;
  description?: string | null;
  curriculum_id?: number | null;
  curriculum_name?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  item_count: number;
  learned_count: number;
  reviewing_count: number;
  new_count: number;
}

export interface VocabularySetLearningDetail extends VocabularySetProgress {
  items: VocabularyLearningItem[];
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface StudyOverview {
  streak_days: number;
  due_today_count: number;
  studied_today_count: number;
  daily_goal: number;
  heatmap: HeatmapDay[];
  xp: number;
  level: number;
  level_xp_floor: number;
  level_xp_ceil: number;
}

export interface ReviewSubmitResult {
  item_id: number;
  status: LearningStatus;
  due_at?: string | null;
  xp_gained: number;
  leveled_up: boolean;
  new_level: number;
}

export interface Achievement {
  code: string;
  name: string;
  description: string;
  earned: boolean;
  progress_current: number;
  progress_target: number;
}

export interface MiniStoryResult {
  story_ja: string;
  story_vi: string;
}

export interface MyVocabularyItem {
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

export interface MySet {
  id: number;
  curriculum_id: number;
  set_name: string;
  description?: string | null;
  item_count: number;
  learned_count: number;
  reviewing_count: number;
  new_count: number;
  created_at: string;
}

export interface MySetDetail extends MySet {
  items: MyVocabularyItem[];
}

export interface MyCurriculum {
  id: number;
  name: string;
  description?: string | null;
  item_count: number;
  learned_count: number;
  reviewing_count: number;
  new_count: number;
  created_at: string;
  sets: MySet[];
}

export interface MyItemCreateInput {
  word: string;
  meaning_vi: string;
  reading?: string;
  han_viet?: string;
  word_type?: string;
  example_sentence_ja?: string;
  example_sentence_vi?: string;
  auto_fill?: boolean;
}

const BASE = "/api/vocabulary/learn";
const MINE_BASE = "/api/vocabulary/mine";

export async function fetchStudyOverview(): Promise<StudyOverview> {
  return request(`${BASE}/overview`, { headers: authHeaders(getToken()), silent: true });
}

export async function updateDailyGoal(dailyGoal: number): Promise<StudyOverview> {
  return request(`${BASE}/settings/daily-goal`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ daily_goal: dailyGoal }),
  });
}

export async function fetchLibrarySets(level?: JlptLevel): Promise<VocabularySetProgress[]> {
  const qs = level ? `?level=${level}` : "";
  return request(`${BASE}/sets${qs}`, { headers: authHeaders(getToken()) });
}

export async function fetchSetForLearning(setId: number): Promise<VocabularySetLearningDetail> {
  return request(`${BASE}/sets/${setId}`, { headers: authHeaders(getToken()) });
}

export async function fetchStudyBatch(
  setId: number,
  source: BatchSource,
  count: number
): Promise<VocabularyLearningItem[]> {
  return request(`${BASE}/sets/${setId}/batch`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ source, count }),
  });
}

export async function fetchDueBatch(count: number): Promise<VocabularyLearningItem[]> {
  return request(`${BASE}/due/batch`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ count }),
  });
}

export async function fetchBookmarked(): Promise<VocabularyLearningItem[]> {
  return request(`${BASE}/bookmarked`, { headers: authHeaders(getToken()) });
}

export async function fetchBookmarkedBatch(count: number): Promise<VocabularyLearningItem[]> {
  return request(`${BASE}/bookmarked/batch`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ count }),
  });
}

export async function submitReview(itemId: number, rating: ReviewRating): Promise<ReviewSubmitResult> {
  return request(`${BASE}/items/${itemId}/review`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ rating }),
  });
}

export async function toggleBookmark(itemId: number): Promise<{ item_id: number; is_bookmarked: boolean }> {
  return request(`${BASE}/items/${itemId}/bookmark`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function fetchAchievements(): Promise<Achievement[]> {
  return request(`${BASE}/achievements`, { headers: authHeaders(getToken()) });
}

export async function generateMiniStory(itemIds: number[]): Promise<MiniStoryResult> {
  return request(`${BASE}/mini-story`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ item_ids: itemIds }),
  });
}

// --- "Bộ từ của tôi": a learner's own private curriculum/sets/words ---

export async function fetchMyCurriculums(): Promise<MyCurriculum[]> {
  return request(`${MINE_BASE}/curriculums`, { headers: authHeaders(getToken()) });
}

export async function createMyCurriculum(name: string, description?: string): Promise<MyCurriculum> {
  return request(`${MINE_BASE}/curriculums`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ name, description }),
  });
}

export async function updateMyCurriculum(
  curriculumId: number,
  payload: { name?: string; description?: string }
): Promise<MyCurriculum> {
  return request(`${MINE_BASE}/curriculums/${curriculumId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteMyCurriculum(curriculumId: number): Promise<{ success: boolean }> {
  return request(`${MINE_BASE}/curriculums/${curriculumId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function createMySet(
  curriculumId: number,
  setName: string,
  description?: string
): Promise<MySet> {
  return request(`${MINE_BASE}/curriculums/${curriculumId}/sets`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ set_name: setName, description }),
  });
}

export async function fetchMySet(setId: number): Promise<MySetDetail> {
  return request(`${MINE_BASE}/sets/${setId}`, { headers: authHeaders(getToken()) });
}

export async function fetchMyStudyBatch(
  setId: number,
  source: BatchSource,
  count: number
): Promise<VocabularyLearningItem[]> {
  return request(`${MINE_BASE}/sets/${setId}/batch`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ source, count }),
  });
}

export async function updateMySet(
  setId: number,
  payload: { set_name?: string; description?: string }
): Promise<MySet> {
  return request(`${MINE_BASE}/sets/${setId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteMySet(setId: number): Promise<{ success: boolean }> {
  return request(`${MINE_BASE}/sets/${setId}`, { method: "DELETE", headers: authHeaders(getToken()) });
}

export async function createMyItem(setId: number, payload: MyItemCreateInput): Promise<MyVocabularyItem> {
  return request(`${MINE_BASE}/sets/${setId}/items`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ auto_fill: true, ...payload }),
  });
}

export async function deleteMyItem(itemId: number): Promise<{ success: boolean }> {
  return request(`${MINE_BASE}/items/${itemId}`, { method: "DELETE", headers: authHeaders(getToken()) });
}

export async function copyItemToMine(itemId: number, targetSetId: number): Promise<MyVocabularyItem> {
  return request(`${MINE_BASE}/copy`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ item_id: itemId, target_set_id: targetSetId }),
  });
}

// Tracks the most recently started playback so an overlapping call (e.g. two
// effect invocations under React StrictMode, or the user re-triggering
// playback before the previous fetch resolved) stops the old audio instead
// of letting both play at once, staggered by whichever network request wins.
let currentAudio: HTMLAudioElement | null = null;

/** Fetches gTTS audio for a Japanese word/sentence and plays it immediately. */
export async function speakJapanese(text: string): Promise<void> {
  const form = new FormData();
  form.append("text", text);
  const res = await fetch(`${BASE_URL}/api/pronunciation/tts`, { method: "POST", body: form });
  if (!res.ok) throw new Error("Không thể phát âm thanh");
  const blob = await res.blob();
  currentAudio?.pause();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
}
