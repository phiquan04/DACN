import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";
import { SectionScore } from "./jlptApi";
import type { ConversationDetail } from "./chatApi";

export type AdminUserAccountStatus = "active" | "inactive" | "locked";

export interface AdminUserSummary {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  account_status: AdminUserAccountStatus;
  // Confirmed via an emailed OTP. Accounts that predate the feature were
  // backfilled as verified, so this is only ever false for newer signups.
  email_verified: boolean;
  locked_reason?: string | null;
  locked_at?: string | null;
  last_login_at?: string | null;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  current_jlpt_level?: string | null;
  vocab_xp: number;
  level: number;
  streak_days: number;
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
  last_activity_at?: string | null;
  total_study_minutes: number;
  level_xp_floor: number;
  level_xp_ceil: number;
  daily_vocab_goal?: number | null;
  profile_updated_at?: string | null;
  xp_percentile_top: number;
  admin_note?: string | null;
}

export type UserRoleFilter = "admin" | "user" | "";
export type UserStatusFilter = AdminUserAccountStatus | "";
export type JlptLevelFilter = "N1" | "N2" | "N3" | "N4" | "N5" | "";

export interface FetchUsersParams {
  search?: string;
  role?: UserRoleFilter;
  status?: UserStatusFilter;
  jlptLevel?: JlptLevelFilter;
  page?: number;
}

export async function fetchUsers(params: FetchUsersParams = {}): Promise<AdminUserListPage> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.role) qs.set("role", params.role);
  if (params.status) qs.set("status", params.status);
  if (params.jlptLevel) qs.set("jlpt_level", params.jlptLevel);
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

// Deliberately excludes current_jlpt_level, target_jlpt_level, and
// daily_vocab_goal — those are the learner's own configured learning
// settings and the backend rejects them from an admin update.
export interface UpdateUserPayload {
  role?: "admin" | "user";
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  admin_note?: string | null;
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

export interface AdminUserVocabularyStats {
  learned: number;
  reviewing: number;
  new: number;
  total_reviews: number;
  studied_today: number;
}

export interface AdminUserJlptStats {
  attempts: number;
  completed: number;
  average_score?: number | null;
  best_score?: number | null;
  last_attempt_at?: string | null;
}

export interface AdminUserConversationStats {
  conversations: number;
  messages_sent: number;
  grammar_checks: number;
  average_errors?: number | null;
}

export interface AdminUserListeningDictionaryStats {
  transcription_sessions: number;
  transcription_completed: number;
  dictionary_searches: number;
}

export interface AdminUserLearningStats {
  vocabulary: AdminUserVocabularyStats;
  jlpt: AdminUserJlptStats;
  conversation: AdminUserConversationStats;
  listening_dictionary: AdminUserListeningDictionaryStats;
}

export async function fetchUserLearningStats(id: number): Promise<AdminUserLearningStats> {
  return request(`/api/admin/users/${id}/learning-stats`, { headers: authHeaders(getToken()) });
}

// One row of the audit log — a real, persisted event (admin action on this
// account, or the user's own learning activity), not a value derived from
// other tables' timestamps.
export interface AdminActivityEntry {
  id: number;
  action: string;
  description: string;
  actor_role?: string | null;
  created_at: string;
}

export async function fetchUserActivity(id: number, limit = 6): Promise<AdminActivityEntry[]> {
  return request(`/api/admin/users/${id}/activity?limit=${limit}`, { headers: authHeaders(getToken()) });
}

// A vocabulary set the user has started (has at least one graded word in
// it) — there's no per-user "enrollment" record, so this is derived from
// their review history, not a roster the admin manages.
export interface AdminUserVocabularySetProgress {
  id: number;
  set_name: string;
  level: string;
  curriculum_name?: string | null;
  item_count: number;
  progress_count: number;
  mastered_count: number;
  percent: number;
  status_label: string;
  status_tone: "pending" | "info" | "success";
}

export interface AdminUserWeakWord {
  word: string;
  reading?: string | null;
  meaning_vi: string;
  again_count: number;
}

export interface AdminUserSrsBucket {
  label: string;
  sublabel: string;
  count: number;
  tone: "info" | "pending" | "neutral" | "success";
}

export interface AdminUserVocabularyDetail {
  total_touched: number;
  studied_today: number;
  mastered: number;
  mastered_percent: number;
  due_today: number;
  accuracy_percent?: number | null;
  accuracy_label: string;
  sets: AdminUserVocabularySetProgress[];
  weak_words: AdminUserWeakWord[];
  srs_distribution: AdminUserSrsBucket[];
}

export async function fetchUserVocabularyDetail(id: number): Promise<AdminUserVocabularyDetail> {
  return request(`/api/admin/users/${id}/vocabulary`, { headers: authHeaders(getToken()) });
}

export async function resetUserVocabularySrs(id: number): Promise<AdminUserVocabularyDetail> {
  return request(`/api/admin/users/${id}/vocabulary/reset-srs`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

// One completed JLPT mock-exam attempt, rescored on the fly to the same
// 0-180 scale shown to the learner (see Backend/app/services/jlpt_scoring.py).
export interface AdminUserJlptAttempt {
  attempt_id: number;
  exam_id: number;
  exam_title: string;
  level: string;
  submitted_at?: string | null;
  duration_minutes?: number | null;
  total: number;
  total_max: number;
  pass_total: number;
  is_pass: boolean;
  sections: SectionScore[];
}

export interface AdminUserJlptWeakMondai {
  section_name: string;
  mondai_no: number;
  mondai_name?: string | null;
  wrong_count: number;
  total_count: number;
  percent_correct: number;
}

export interface AdminUserJlptProgressPoint {
  attempt_id: number;
  label: string;
  submitted_at?: string | null;
  total: number;
}

// Correct/total for one mondai on the learner's single most recent attempt
// — every mondai they saw that time, not just the ones they struggle with.
export interface AdminUserJlptMondaiScore {
  section_name: string;
  mondai_no: number;
  name?: string | null;
  correct: number;
  total: number;
  percent: number;
  tier_label: string;
  tier_tone: "neutral" | "success" | "pending" | "danger" | "info";
}

// The learner's own chosen target sitting (JlptUserExamPlan) for their
// target_jlpt_level — absent when they haven't picked one yet.
export interface AdminUserJlptNextTarget {
  level: string;
  exam_date: string;
  months_left: number;
}

export interface AdminUserJlptDetail {
  attempts: AdminUserJlptAttempt[];
  attempts_total: number;
  scope_level?: string | null;
  average_total?: number | null;
  best_total?: number | null;
  pass_estimate_percent?: number | null;
  delta_total?: number | null;
  progress: AdminUserJlptProgressPoint[];
  weak_mondai: AdminUserJlptWeakMondai[];
  latest_attempt_label?: string | null;
  latest_mondai_breakdown: AdminUserJlptMondaiScore[];
  next_target?: AdminUserJlptNextTarget | null;
  insight_message?: string | null;
}

export async function fetchUserJlptDetail(id: number): Promise<AdminUserJlptDetail> {
  return request(`/api/admin/users/${id}/jlpt`, { headers: authHeaders(getToken()) });
}

// Full graded Q&A for one completed attempt — "Xem bài làm".
export interface AdminUserJlptChoice {
  choice_no: number;
  choice_text: string;
}

export interface AdminUserJlptAnswerDetail {
  question_no: number;
  question_text: string;
  passage_text?: string | null;
  choices: AdminUserJlptChoice[];
  selected_choice_no?: number | null;
  correct_no?: number | null;
  is_correct: boolean;
  explanation?: string | null;
  section_name: string;
  mondai_no: number;
  mondai_name?: string | null;
}

export interface AdminUserJlptAttemptDetail {
  attempt_id: number;
  exam_title: string;
  level: string;
  submitted_at?: string | null;
  score: number;
  total_questions: number;
  answers: AdminUserJlptAnswerDetail[];
}

export async function fetchUserJlptAttemptDetail(userId: number, attemptId: number): Promise<AdminUserJlptAttemptDetail> {
  return request(`/api/admin/users/${userId}/jlpt/attempts/${attemptId}`, { headers: authHeaders(getToken()) });
}

// One dictionary lookup this user made — a real SearchHistory row.
export interface AdminUserLookupEntry {
  id: number;
  word: string;
  reading?: string | null;
  meaning?: string | null;
  jlpt?: string | null;
  created_at: string;
}

// A word this user has looked up more than once, most-searched first.
export interface AdminUserTopWord {
  word: string;
  reading?: string | null;
  meaning?: string | null;
  jlpt?: string | null;
  search_count: number;
  last_searched_at: string;
}

export interface AdminUserJlptLookupBucket {
  level: string;
  count: number;
  tone: "neutral" | "success" | "pending" | "danger" | "info";
}

// One video transcription/translation session — a real TranscriptionSession
// row. There's no shadowing/dictation scoring feature in this codebase.
export interface AdminUserListeningVideo {
  id: number;
  video_title?: string | null;
  thumbnail?: string | null;
  channel_title?: string | null;
  source_type: string;
  status: string;
  status_label: string;
  status_tone: "neutral" | "success" | "pending" | "danger" | "info";
  segment_count: number;
  duration_ms?: number | null;
  created_at: string;
}

export interface AdminUserListeningDetail {
  total_lookups: number;
  unique_words: number;
  lookups_today: number;
  video_sessions_total: number;
  video_sessions_completed: number;
  total_listening_minutes: number;
  recent_lookups: AdminUserLookupEntry[];
  top_words: AdminUserTopWord[];
  jlpt_distribution: AdminUserJlptLookupBucket[];
  videos: AdminUserListeningVideo[];
}

export async function fetchUserListeningDetail(id: number): Promise<AdminUserListeningDetail> {
  return request(`/api/admin/users/${id}/listening`, { headers: authHeaders(getToken()) });
}

export async function clearUserSearchHistory(id: number): Promise<AdminUserListeningDetail> {
  return request(`/api/admin/users/${id}/listening/search-history`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// One conversation in the admin history list — real Conversation + Message
// rows, no fabricated "naturalness score".
export interface AdminUserConversationSummary {
  id: number;
  title?: string | null;
  scenario_title?: string | null;
  scenario_level?: string | null;
  message_count: number;
  error_count: number;
  started_at: string;
  last_message_at: string;
}

// One error category from the LLM's per-error explanation.error_type (same
// freeform classification the learner-facing /correct/stats groups by),
// with one representative real example.
export interface AdminUserGrammarErrorType {
  error_type: string;
  count: number;
  percent: number;
  example_original?: string | null;
  example_corrected?: string | null;
  example_why_wrong?: string | null;
}

export interface AdminUserConversationDetail {
  total_conversations: number;
  total_messages_sent: number;
  total_duration_minutes: number;
  grammar_checks: number;
  total_errors: number;
  correct_message_rate?: number | null;
  off_topic_rate?: number | null;
  conversations: AdminUserConversationSummary[];
  top_error_types: AdminUserGrammarErrorType[];
  insight_message?: string | null;
}

export async function fetchUserConversationDetail(id: number): Promise<AdminUserConversationDetail> {
  return request(`/api/admin/users/${id}/conversation`, { headers: authHeaders(getToken()) });
}

export async function fetchUserConversationTranscript(userId: number, conversationId: number): Promise<ConversationDetail> {
  return request(`/api/admin/users/${userId}/conversation/${conversationId}`, { headers: authHeaders(getToken()) });
}

export async function clearUserConversationGrammarHistory(id: number): Promise<AdminUserConversationDetail> {
  return request(`/api/admin/users/${id}/conversation/grammar-history`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}
