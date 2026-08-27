import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { getStoredUser } from "../../services/authApi";
import {
  AttemptHistoryItem,
  JlptLevel,
  LevelAverage,
  PublishedExamSummary,
  SubmitAttemptResult,
  TakeExam,
  fetchAverageByLevel,
  fetchExamToTake,
  fetchMyAttempts,
  fetchPublishedExams,
  submitAttempt,
} from "../../services/jlptApi";
import AttemptHistoryPanel from "./AttemptHistoryPanel";
import ExamBrowseList from "./ExamBrowseList";
import ExamResultView from "./ExamResultView";
import TakeExamView from "./TakeExamView";

type View = "browse" | "take" | "result";

export default function JLPTPractice() {
  const { showToast } = useToast();
  const currentUser = getStoredUser();

  const [view, setView] = useState<View>("browse");
  const [level, setLevel] = useState<JlptLevel | "ALL">("ALL");
  const [exams, setExams] = useState<PublishedExamSummary[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [averages, setAverages] = useState<LevelAverage[]>([]);
  const [history, setHistory] = useState<AttemptHistoryItem[]>([]);

  const [activeExam, setActiveExam] = useState<TakeExam | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadExams = async (lv: JlptLevel | "ALL") => {
    setLoadingExams(true);
    try {
      setExams(await fetchPublishedExams(lv === "ALL" ? undefined : lv));
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    loadExams(level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    if (!currentUser) return;
    fetchAverageByLevel().then(setAverages);
    fetchMyAttempts().then(setHistory);
    // currentUser comes from getStoredUser(), which JSON.parses localStorage
    // on every render and so returns a new object reference each time —
    // depending on the object itself would re-run this effect (and refetch)
    // on every render, forever. Depend on the primitive id instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const handleStart = async (examId: number) => {
    try {
      const exam = await fetchExamToTake(examId);
      setActiveExam(exam);
      setView("take");
    } catch {
      // reported globally
    }
  };

  const handleSubmit = async (answers: { question_id: number; selected_choice_no: number | null }[]) => {
    if (!activeExam) return;
    if (!currentUser) {
      showToast("Vui lòng đăng nhập để nộp bài và lưu kết quả", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitAttempt(activeExam.id, answers);
      setResult(res);
      setView("result");
      fetchAverageByLevel().then(setAverages);
      fetchMyAttempts().then(setHistory);
    } catch {
      // reported globally
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToBrowse = () => {
    setActiveExam(null);
    setResult(null);
    setView("browse");
    loadExams(level);
  };

  if (view === "take" && activeExam) {
    return (
      <TakeExamView
        exam={activeExam}
        onSubmit={handleSubmit}
        onCancel={handleBackToBrowse}
        submitting={submitting}
      />
    );
  }

  if (view === "result" && activeExam && result) {
    return <ExamResultView exam={activeExam} result={result} onBack={handleBackToBrowse} />;
  }

  return (
    <div className="space-y-5">
      {currentUser && <AttemptHistoryPanel averages={averages} history={history} />}
      <ExamBrowseList
        exams={exams}
        loading={loadingExams}
        level={level}
        onLevelChange={setLevel}
        onStart={handleStart}
      />
    </div>
  );
}
