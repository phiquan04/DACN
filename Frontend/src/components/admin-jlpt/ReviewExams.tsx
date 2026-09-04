import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  ExamReview,
  ExamSummary,
  QuestionCreate,
  QuestionPatch,
  SECTION_LABELS,
  aiPreprocessExam,
  createQuestion,
  deleteExam,
  deleteQuestion,
  fetchAdminExams,
  fetchExamReview,
  publishExam,
  updateQuestion,
} from "../../services/jlptApi";
import NewQuestionForm from "./NewQuestionForm";
import ReviewQuestionCard from "./ReviewQuestionCard";
import { AlertIcon, TrashIcon } from "./icons";
import { CheckIcon } from "../../icons/custom";
import { ChevronLeftIcon } from "../../icons";

function StatusBadge({ status }: { status: string }) {
  const isPublished = status === "published";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
        isPublished
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
      }`}
    >
      {isPublished ? "Đã publish" : "Nháp"}
    </span>
  );
}

export default function ReviewExams({ focusExamId }: { focusExamId?: number | null }) {
  const { showToast } = useToast();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(focusExamId ?? null);
  const [detail, setDetail] = useState<ExamReview | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    try {
      setExams(await fetchAdminExams());
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (focusExamId) setSelectedId(focusExamId);
  }, [focusExamId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    fetchExamReview(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSaveQuestion = async (questionId: number, patch: QuestionPatch) => {
    if (!selectedId) return;
    try {
      await updateQuestion(selectedId, questionId, patch);
      const refreshed = await fetchExamReview(selectedId);
      setDetail(refreshed);
      showToast(patch.mondai_template_id ? "Đã chuyển câu sang mondai khác" : "Đã lưu câu hỏi", "success");
    } catch {
      // reported globally
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!selectedId) return;
    try {
      await deleteQuestion(selectedId, questionId);
      const refreshed = await fetchExamReview(selectedId);
      setDetail(refreshed);
      showToast("Đã xóa câu hỏi", "success");
    } catch {
      // reported globally
    }
  };

  const handleCreateQuestion = async (payload: QuestionCreate) => {
    if (!selectedId) return;
    try {
      await createQuestion(selectedId, payload);
      const refreshed = await fetchExamReview(selectedId);
      setDetail(refreshed);
      showToast("Đã thêm câu hỏi mới", "success");
    } catch {
      // reported globally
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setPublishing(true);
    try {
      await publishExam(selectedId);
      showToast("Đã publish đề thi — user có thể làm bài ngay", "success");
      const refreshed = await fetchExamReview(selectedId);
      setDetail(refreshed);
      await loadList();
    } catch {
      // reported globally (409 detail liệt kê câu còn thiếu)
    } finally {
      setPublishing(false);
    }
  };

  const handleAiPreprocess = async () => {
    if (!selectedId) return;
    setAiProcessing(true);
    try {
      const refreshed = await aiPreprocessExam(selectedId);
      setDetail(refreshed);
      showToast("AI đã xử lý xong — kiểm tra lại định dạng/đáp án trước khi publish", "success");
    } catch {
      // reported globally
    } finally {
      setAiProcessing(false);
    }
  };

  const handleDelete = async (examId: number) => {
    if (!window.confirm("Xóa đề thi này? Hành động không thể hoàn tác.")) return;
    try {
      await deleteExam(examId);
      showToast("Đã xóa đề thi", "success");
      if (selectedId === examId) setSelectedId(null);
      await loadList();
    } catch {
      // reported globally
    }
  };

  if (selectedId && detail) {
    const mondaiOptions = detail.sections.flatMap((s) =>
      s.mondai.map((m) => ({
        id: m.mondai_template_id,
        label: `${SECTION_LABELS[s.section_type]} — 問題${m.mondai_no}${m.name ? ` (${m.name})` : ""}`,
      }))
    );

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div>
            <div className="flex items-center gap-2">
              <h3 lang="ja" className="text-base font-semibold text-gray-800 dark:text-white/90">
                {detail.title}
              </h3>
              <StatusBadge status={detail.status} />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {detail.level} · {detail.reviewed_count}/{detail.total_questions} câu đã duyệt
            </p>
          </div>
          <div className="flex items-center gap-2">
            {detail.status !== "published" && (
              <button
                type="button"
                onClick={handleAiPreprocess}
                disabled={aiProcessing || publishing}
                title="Nhờ AI tự thêm định dạng gạch chân/in đậm, chọn đáp án còn thiếu và viết giải thích cho các câu chưa duyệt"
                className="flex items-center gap-1.5 rounded-lg border border-teal-500 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-teal-500/10"
              >
                {aiProcessing ? "AI đang xử lý..." : "Nhờ AI xử lý trước"}
              </button>
            )}
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || aiProcessing || detail.status === "published"}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {detail.status === "published" && <CheckIcon className="h-4 w-4" />}
              {detail.status === "published"
                ? "Đã publish"
                : publishing
                ? "Đang publish..."
                : "Lưu chính thức (Publish)"}
            </button>
          </div>
        </div>

        {detail.sections.map((section) => (
          <div key={section.section_type} className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {SECTION_LABELS[section.section_type]} — {section.name}
            </h4>
            {section.mondai.map((mondai) => (
              <div
                key={mondai.mondai_template_id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="mb-3">
                  <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">
                    問題 {mondai.mondai_no} {mondai.name ? `— ${mondai.name}` : ""}
                  </span>
                  {mondai.description && (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{mondai.description}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {mondai.questions.map((q) => (
                    <ReviewQuestionCard
                      key={`${q.id}-${q.updated_at ?? ""}`}
                      question={q}
                      mondaiOptions={mondaiOptions}
                      currentMondaiId={mondai.mondai_template_id}
                      onSave={(patch) => handleSaveQuestion(q.id, patch)}
                      onDelete={() => handleDeleteQuestion(q.id)}
                    />
                  ))}
                  <NewQuestionForm
                    mondaiTemplateId={mondai.mondai_template_id}
                    hasPassage={section.section_type === "dokkai"}
                    onCreate={handleCreateQuestion}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (selectedId && loadingDetail) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải đề thi...</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {loadingList && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
      {!loadingList && exams.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có đề thi nào được import.</p>
      )}
      {exams.map((exam) => (
        <div
          key={exam.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(exam.id)}>
            <div className="flex items-center gap-2">
              <span lang="ja" className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                {exam.title}
              </span>
              <StatusBadge status={exam.status} />
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {exam.level} · {exam.reviewed_count}/{exam.question_count} câu đã duyệt
              </span>
              {!exam.has_answer_key && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertIcon className="h-3 w-3" /> chưa có đáp án gốc
                </span>
              )}
            </p>
          </button>
          <button
            type="button"
            onClick={() => handleDelete(exam.id)}
            className="shrink-0 text-gray-400 hover:text-error-500"
            title="Xóa đề"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
