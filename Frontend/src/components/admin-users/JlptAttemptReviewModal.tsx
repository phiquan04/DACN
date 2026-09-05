import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import { AdminUserJlptAttemptDetail, fetchUserJlptAttemptDetail } from "../../services/adminUserApi";
import { formatApiDateTime } from "../../utils/datetime";

interface Props {
  userId: number;
  attemptId: number;
  onClose: () => void;
}

export default function JlptAttemptReviewModal({ userId, attemptId, onClose }: Props) {
  const [detail, setDetail] = useState<AdminUserJlptAttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserJlptAttemptDetail(userId, attemptId)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attemptId]);

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-3xl overflow-y-auto p-6">
      {loading || !detail ? (
        <div className="flex h-40 items-center justify-center text-sm text-gray-500 dark:text-gray-400">Đang tải bài làm...</div>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{detail.exam_title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {detail.level} · {formatApiDateTime(detail.submitted_at)} · {detail.score}/{detail.total_questions} câu đúng
          </p>

          <div className="mt-4 flex flex-col gap-4">
            {detail.answers.map((a) => (
              <div
                key={a.question_no}
                className={`rounded-lg border p-4 ${
                  a.is_correct
                    ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10"
                    : "border-rose-200 bg-rose-50/40 dark:border-rose-800 dark:bg-rose-900/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Câu {a.question_no} · {a.section_name} · Mondai {a.mondai_no}
                    {a.mondai_name ? ` (${a.mondai_name})` : ""}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      a.is_correct
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                    }`}
                  >
                    {a.is_correct ? "Đúng" : "Sai"}
                  </span>
                </div>

                {a.passage_text && (
                  <p className="mt-2 whitespace-pre-line rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300" lang="ja">
                    {a.passage_text}
                  </p>
                )}

                <p className="mt-2 text-sm font-medium text-gray-800 dark:text-white/90" lang="ja">
                  {a.question_text}
                </p>

                <ul className="mt-2 flex flex-col gap-1.5">
                  {a.choices.map((c) => {
                    const isSelected = c.choice_no === a.selected_choice_no;
                    const isCorrectChoice = c.choice_no === a.correct_no;
                    return (
                      <li
                        key={c.choice_no}
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                          isCorrectChoice
                            ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                            : isSelected
                              ? "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                              : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                        }`}
                        lang="ja"
                      >
                        <span className="font-medium">{c.choice_no}.</span> {c.choice_text}
                        {isCorrectChoice && <span className="ml-auto text-xs font-normal">Đáp án đúng</span>}
                        {isSelected && !isCorrectChoice && <span className="ml-auto text-xs font-normal">Học viên chọn</span>}
                      </li>
                    );
                  })}
                </ul>

                {a.explanation && (
                  <p className="mt-2 text-xs italic text-gray-500 dark:text-gray-400">{a.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
