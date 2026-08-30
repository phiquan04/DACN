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

const BASE = "/api/vocabulary/learn";

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
