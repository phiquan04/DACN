import { authHeaders, jsonHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export type JlptLevel = "N1" | "N2" | "N3" | "N4" | "N5";
export const JLPT_LEVELS: JlptLevel[] = ["N1", "N2", "N3", "N4", "N5"];

export type SectionType = "kotoba" | "dokkai" | "choukai";

export const SECTION_LABELS: Record<SectionType, string> = {
  kotoba: "Từ vựng · Chữ viết (文字・語彙)",
  dokkai: "Ngữ pháp · Đọc hiểu (文法・読解)",
  choukai: "Nghe hiểu (聴解)",
};

// ---------- Structure setup (admin) ----------

export interface MondaiTemplate {
  id?: number;
  mondai_no: number;
  name?: string | null;
  description?: string | null;
  tips?: string | null;
  question_count?: number | null;
  time_minutes?: number | null;
}

export interface SectionStructure {
  id?: number;
  section_type: SectionType;
  name: string;
  order_no: number;
  time_minutes?: number | null;
  mondai: MondaiTemplate[];
}

export interface LevelStructure {
  id: number;
  level: string;
  total_time_minutes?: number | null;
  notes?: string | null;
  sections: SectionStructure[];
}

export interface LevelStructureSummary {
  level: string;
  is_configured: boolean;
  total_time_minutes: number | null;
  section_count: number;
  mondai_count: number;
}

export async function fetchStructureSummaries(): Promise<LevelStructureSummary[]> {
  return request(`/api/jlpt/structure`, { silent: true });
}

export async function fetchStructure(level: JlptLevel): Promise<LevelStructure | null> {
  try {
    return await request(`/api/jlpt/structure/${level}`, { silent: true });
  } catch {
    return null;
  }
}

export async function saveStructure(
  level: JlptLevel,
  payload: { total_time_minutes?: number | null; notes?: string | null; sections: SectionStructure[] }
): Promise<LevelStructure> {
  return request(`/api/jlpt/structure/${level}`, {
    method: "PUT",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteStructure(level: JlptLevel): Promise<void> {
  await request(`/api/jlpt/structure/${level}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// ---------- Import (admin) ----------

export interface ImportExamResult {
  exam_id: number;
  title: string;
  level: string;
  status: string;
  question_count: number;
  has_answer_key: boolean;
  unmapped_count: number;
}

export async function importExam(params: {
  level: JlptLevel;
  title?: string;
  year?: number;
  month?: number;
  examFile: File;
  answerFile?: File | null;
}): Promise<ImportExamResult> {
  const form = new FormData();
  form.append("level", params.level);
  if (params.title) form.append("title", params.title);
  if (params.year) form.append("year", String(params.year));
  if (params.month) form.append("month", String(params.month));
  form.append("exam", params.examFile);
  if (params.answerFile) form.append("answer", params.answerFile);

  return request(`/api/jlpt/exams/import`, {
    method: "POST",
    headers: authHeaders(getToken()),
    body: form,
  });
}

// ---------- Review (admin) ----------

export interface ExamSummary {
  id: number;
  title: string;
  level: string;
  status: "draft" | "published";
  year?: number | null;
  month?: number | null;
  has_answer_key: boolean;
  question_count: number;
  reviewed_count: number;
}

export interface ChoiceItem {
  id: number;
  choice_no: number;
  choice_text: string;
}

export interface QuestionReview {
  id: number;
  question_no: number;
  question_text: string;
  passage_text?: string | null;
  choices: ChoiceItem[];
  correct_no?: number | null;
  explanation?: string | null;
  is_reviewed: boolean;
  updated_at?: string | null;
}

export interface MondaiReviewGroup {
  mondai_template_id: number;
  mondai_no: number;
  name?: string | null;
  description?: string | null;
  tips?: string | null;
  questions: QuestionReview[];
}

export interface SectionReviewGroup {
  section_type: SectionType;
  name: string;
  mondai: MondaiReviewGroup[];
}

export interface ExamReview {
  id: number;
  title: string;
  level: string;
  year?: number | null;
  month?: number | null;
  status: "draft" | "published";
  has_answer_key: boolean;
  sections: SectionReviewGroup[];
  total_questions: number;
  reviewed_count: number;
  ready_to_publish: boolean;
}

export async function fetchAdminExams(params?: { level?: JlptLevel; status?: string }): Promise<ExamSummary[]> {
  const query = new URLSearchParams();
  if (params?.level) query.set("level", params.level);
  if (params?.status) query.set("status", params.status);
  const qs = query.toString();
  return request(`/api/jlpt/exams${qs ? `?${qs}` : ""}`, { headers: authHeaders(getToken()) });
}

export async function fetchExamReview(examId: number): Promise<ExamReview> {
  return request(`/api/jlpt/exams/${examId}`, { headers: authHeaders(getToken()) });
}

/** Runs a second, text-only AI pass over every not-yet-reviewed question:
 * adds <u>/<b> formatting tags, fills correct_no when missing, and writes
 * an explanation — a pre-fill step before the admin reviews by hand. */
export async function aiPreprocessExam(examId: number): Promise<ExamReview> {
  return request(`/api/jlpt/exams/${examId}/ai-preprocess`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export interface QuestionPatch {
  mondai_template_id?: number;
  question_text?: string;
  passage_text?: string;
  choices?: { choice_no: number; choice_text: string }[];
  correct_no?: number | null;
  explanation?: string;
  is_reviewed?: boolean;
}

export async function updateQuestion(
  examId: number,
  questionId: number,
  patch: QuestionPatch
): Promise<QuestionReview> {
  return request(`/api/jlpt/exams/${examId}/questions/${questionId}`, {
    method: "PATCH",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(patch),
  });
}

export interface QuestionCreate {
  mondai_template_id: number;
  question_text: string;
  passage_text?: string | null;
  choices?: { choice_no: number; choice_text: string }[];
  correct_no?: number | null;
  explanation?: string | null;
}

export async function createQuestion(examId: number, payload: QuestionCreate): Promise<QuestionReview> {
  return request(`/api/jlpt/exams/${examId}/questions`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestion(examId: number, questionId: number): Promise<void> {
  await request(`/api/jlpt/exams/${examId}/questions/${questionId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

export async function publishExam(examId: number): Promise<ExamSummary> {
  return request(`/api/jlpt/exams/${examId}/publish`, {
    method: "POST",
    headers: authHeaders(getToken()),
  });
}

export async function deleteExam(examId: number): Promise<void> {
  await request(`/api/jlpt/exams/${examId}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

// ---------- User-facing: browse / take / submit / history ----------

export interface TakeChoice {
  choice_no: number;
  choice_text: string;
}

export interface TakeQuestion {
  id: number;
  question_no: number;
  question_text: string;
  passage_text?: string | null;
  choices: TakeChoice[];
}

export interface TakeMondai {
  mondai_no: number;
  name?: string | null;
  description?: string | null;
  tips?: string | null;
  time_minutes?: number | null;
  question_count?: number | null;
  questions: TakeQuestion[];
}

export interface TakeSection {
  section_type: SectionType;
  name: string;
  time_minutes?: number | null;
  mondai: TakeMondai[];
}

export interface TakeExam {
  id: number;
  title: string;
  level: string;
  total_time_minutes?: number | null;
  sections: TakeSection[];
}

export interface PublishedExamSummary {
  id: number;
  title: string;
  level: string;
  year?: number | null;
  month?: number | null;
  total_time_minutes?: number | null;
  question_count: number;
  best_score?: number | null;
  best_total?: number | null;
  attempt_count: number;
}

export async function fetchPublishedExams(level?: JlptLevel): Promise<PublishedExamSummary[]> {
  const qs = level ? `?level=${level}` : "";
  return request(`/api/jlpt/published-exams${qs}`, { headers: authHeaders(getToken()), silent: true });
}

export async function fetchExamToTake(examId: number): Promise<TakeExam> {
  return request(`/api/jlpt/published-exams/${examId}`);
}

export interface ExamRankingEntry {
  rank: number;
  user_id: number;
  username: string;
  avatar_url?: string | null;
  is_verified: boolean;
  score: number;
  total_questions: number;
  percent: number;
  submitted_at?: string | null;
  duration_minutes?: number | null;
  is_me: boolean;
}

export interface ExamRanking {
  entries: ExamRankingEntry[];
  me: ExamRankingEntry | null;
  total_attempts: number;
  pass_total?: number | null;
}

export async function fetchExamRanking(examId: number): Promise<ExamRanking> {
  return request(`/api/jlpt/published-exams/${examId}/ranking`, { headers: authHeaders(getToken()), silent: true });
}

export interface GradedAnswer {
  question_id: number;
  selected_choice_no?: number | null;
  correct_no?: number | null;
  is_correct: boolean;
  explanation?: string | null;
}

export interface SectionScore {
  section_type: SectionType;
  name: string;
  score: number;
  max: number;
  floor: number;
  above_floor: boolean;
}

export interface SubmitAttemptResult {
  attempt_id: number;
  exam_id: number;
  score: number;
  total_questions: number;
  percent: number;
  answers: GradedAnswer[];
  total?: number | null;
  total_max?: number | null;
  pass_total?: number | null;
  is_pass?: boolean | null;
  sections: SectionScore[];
}

export async function submitAttempt(
  examId: number,
  answers: { question_id: number; selected_choice_no: number | null }[]
): Promise<SubmitAttemptResult> {
  return request(`/api/jlpt/published-exams/${examId}/submit`, {
    method: "POST",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify({ answers }),
  });
}

// ---------- User-facing: dashboard (upcoming exam / predicted score / weak mondai) ----------

export interface ExamSchedule {
  id: number;
  level?: string | null;
  exam_date: string;
  registration_deadline: string;
}

export interface ExamPlan {
  id: number;
  level: string;
  location?: string | null;
  schedule: ExamSchedule;
}

export interface ScoreBreakdown {
  total: number;
  total_max: number;
  pass_total: number;
  is_pass: boolean;
  sections: SectionScore[];
}

export interface WeakMondai {
  section_type: SectionType;
  section_name: string;
  mondai_no: number;
  mondai_name?: string | null;
  wrong_count: number;
  total_count: number;
  percent_correct: number;
}

export interface UpcomingExam {
  schedule: ExamSchedule;
  location?: string | null;
  days_left: number;
  study_pace_message: string;
}

export interface JlptDashboard {
  predicted: ScoreBreakdown | null;
  weak_mondai: WeakMondai[];
  upcoming_exam: UpcomingExam | null;
}

export async function fetchSchedules(level?: JlptLevel): Promise<ExamSchedule[]> {
  const qs = level ? `?level=${level}` : "";
  return request(`/api/jlpt/schedules${qs}`, { silent: true });
}

export async function saveExamPlan(payload: {
  level: JlptLevel;
  schedule_id: number;
  location?: string | null;
}): Promise<ExamPlan> {
  return request(`/api/jlpt/exam-plan`, {
    method: "PUT",
    headers: jsonHeaders(getToken()),
    body: JSON.stringify(payload),
  });
}

export async function fetchDashboard(level: JlptLevel): Promise<JlptDashboard | null> {
  try {
    return await request(`/api/jlpt/dashboard?level=${level}`, { headers: authHeaders(getToken()), silent: true });
  } catch {
    return null;
  }
}

// ---------- User-facing: attempt history ----------

export interface AttemptHistoryItem {
  attempt_id: number;
  exam_id: number;
  exam_title: string;
  level: string;
  score: number;
  total_questions: number;
  percent: number;
  submitted_at?: string | null;
  is_pass?: boolean | null;
}

export interface LevelAverage {
  level: string;
  attempt_count: number;
  average_percent: number;
}

export async function fetchMyAttempts(level?: JlptLevel): Promise<AttemptHistoryItem[]> {
  const qs = level ? `?level=${level}` : "";
  return request(`/api/jlpt/attempts/me${qs}`, { headers: authHeaders(getToken()), silent: true });
}

export async function fetchLevelAverages(): Promise<LevelAverage[]> {
  return request(`/api/jlpt/attempts/average`, { headers: authHeaders(getToken()), silent: true });
}
