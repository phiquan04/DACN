import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { AlertIcon, CheckCircleIcon, ChevronLeftIcon } from "../../icons";
import {
  fetchDueGrammarExercises,
  GrammarExerciseItem,
  submitGrammarExerciseAnswer,
} from "../../services/grammarContentApi";

type Feedback = {
  correct: boolean;
  correctAnswer: string;
};

const BATCH_SIZE = 20;

export default function GrammarPractice() {
  const { setId } = useParams<{ setId?: string }>();
  const numericSetId = setId ? Number(setId) : undefined;
  const { setPageHeader } = usePageHeader();

  const [batch, setBatch] = useState<GrammarExerciseItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const backHref = numericSetId ? `/grammar-bank/${numericSetId}` : "/grammar-bank";

  useEffect(() => {
    setPageHeader("Luyện tập ngữ pháp", "Ôn các mẫu ngữ pháp đến hạn bằng bài tập tự chấm điểm");
  }, [setPageHeader]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDueGrammarExercises({ limit: BATCH_SIZE, setId: numericSetId })
      .then((data) => {
        if (cancelled) return;
        setBatch(data);
        setIndex(0);
        setCorrectCount(0);
        setFinished(false);
        setFeedback(null);
        setAnswer("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải bài luyện tập");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericSetId]);

  const current = useMemo(() => (batch && !finished ? batch[index] : undefined), [batch, finished, index]);

  const handleCheck = async (chosenAnswer: string) => {
    if (!current || submitting || feedback) return;
    setSubmitting(true);
    try {
      const res = await submitGrammarExerciseAnswer(current.id, chosenAnswer);
      if (res.correct) setCorrectCount((c) => c + 1);
      setFeedback({ correct: res.correct, correctAnswer: res.correct_answer });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể chấm bài tập này, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!batch) return;
    setFeedback(null);
    setAnswer("");
    if (index + 1 >= batch.length) {
      setFinished(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <>
      <PageMeta title="Luyện tập ngữ pháp" description="Ôn các mẫu ngữ pháp đến hạn bằng bài tập tự chấm điểm" />

      <Link
        to={backHref}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại
      </Link>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      ) : !batch || batch.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Không có mẫu ngữ pháp nào cần ôn ngay bây giờ
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Hãy quay lại kho ngữ pháp để khám phá thêm các mẫu mới, hoặc chờ đến khi có mẫu cần ôn lại.
          </p>
          <Link
            to={backHref}
            className="mt-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Về kho ngữ pháp
          </Link>
        </div>
      ) : finished ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircleIcon className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Hoàn thành phiên luyện tập!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Bạn đã ôn {batch.length} mẫu ngữ pháp, đúng {correctCount}/{batch.length}.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to={backHref}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
            >
              {numericSetId ? "Về chi tiết bộ" : "Về kho ngữ pháp"}
            </Link>
          </div>
        </div>
      ) : current ? (
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full bg-gray-900 transition-all dark:bg-white"
                style={{ width: `${(index / batch.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
              {index + 1}/{batch.length}
            </span>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              {current.grammar_pattern}
            </span>

            <p lang="ja" className="mt-4 text-lg font-medium leading-relaxed text-gray-800 dark:text-white/90">
              {current.prompt}
            </p>

            {current.type === "cloze" ? (
              <div className="mt-5 space-y-3">
                <input
                  type="text"
                  lang="ja"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!feedback}
                  placeholder="Nhập phần còn thiếu..."
                  className="h-11 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-800 outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:disabled:bg-gray-800/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !feedback && answer.trim()) handleCheck(answer);
                  }}
                />
                {!feedback && (
                  <button
                    type="button"
                    onClick={() => handleCheck(answer)}
                    disabled={submitting || !answer.trim()}
                    className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-200"
                  >
                    Kiểm tra
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-2.5">
                {(current.choices ?? []).map((choice) => {
                  const isChosen = answer === choice;
                  const isCorrectChoice = feedback && choice === feedback.correctAnswer;
                  const isWrongChosen = feedback && isChosen && !feedback.correct;
                  return (
                    <button
                      key={choice}
                      type="button"
                      lang="ja"
                      disabled={!!feedback}
                      onClick={() => {
                        setAnswer(choice);
                        handleCheck(choice);
                      }}
                      className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                        isCorrectChoice
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : isWrongChosen
                            ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                            : "border-gray-200 text-gray-700 hover:border-brand-400 dark:border-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            {feedback && (
              <div
                className={`mt-5 rounded-lg p-3.5 text-sm ${
                  feedback.correct
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                }`}
              >
                <p className="flex items-center gap-1.5 font-semibold">
                  {feedback.correct ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4" /> Đúng!
                    </>
                  ) : (
                    <>
                      <AlertIcon className="h-4 w-4" /> Sai
                    </>
                  )}
                </p>
                {!feedback.correct && (
                  <p className="mt-1" lang="ja">
                    Đáp án đúng: <span className="font-medium">{feedback.correctAnswer}</span>
                  </p>
                )}
              </div>
            )}

            {feedback && (
              <button
                type="button"
                onClick={handleNext}
                className="mt-5 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
              >
                Tiếp theo
              </button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
