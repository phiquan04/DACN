import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { getStoredUser } from "../../services/authApi";
import {
  JlptDashboard,
  JlptLevel,
  PublishedExamSummary,
  SubmitAttemptResult,
  TakeExam,
  fetchDashboard,
  fetchExamToTake,
  fetchPublishedExams,
  fetchStructure,
  submitAttempt,
} from "../../services/jlptApi";
import ExamBrowseList from "./ExamBrowseList";
import ExamResultView from "./ExamResultView";
import PredictedScoreCard from "./PredictedScoreCard";
import TakeExamView from "./TakeExamView";
import UpcomingExamCard from "./UpcomingExamCard";
import WeakMondaiCard from "./WeakMondaiCard";

type View = "browse" | "take" | "result";
const DEFAULT_LEVEL: JlptLevel = "N3";

export default function JLPTPractice() {
  const { showToast } = useToast();
  const currentUser = getStoredUser();

  const [view, setView] = useState<View>("browse");
  const [level, setLevel] = useState<JlptLevel | "ALL">("ALL");
  const [exams, setExams] = useState<PublishedExamSummary[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [dashboard, setDashboard] = useState<JlptDashboard | null>(null);
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | null>(null);

  const [activeExam, setActiveExam] = useState<TakeExam | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dashboardLevel: JlptLevel = level === "ALL" ? DEFAULT_LEVEL : level;

  const loadExams = async (lv: JlptLevel | "ALL") => {
    setLoadingExams(true);
    try {
      setExams(await fetchPublishedExams(lv === "ALL" ? undefined : lv));
    } finally {
      setLoadingExams(false);
    }
  };

  const loadDashboard = () => {
    if (!currentUser) return;
    fetchDashboard(dashboardLevel).then(setDashboard);
    fetchStructure(dashboardLevel).then((s) => setTotalTimeMinutes(s?.total_time_minutes ?? null));
  };

  useEffect(() => {
    loadExams(level);
  }, [level]);

  useEffect(() => {
    loadDashboard();
    // currentUser comes from getStoredUser(), which JSON.parses localStorage
    // on every render and so returns a new object reference each time —
    // depending on the object itself would re-run this effect (and refetch)
    // on every render, forever. Depend on the primitive id instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, dashboardLevel]);

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
      loadDashboard();
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
      {currentUser && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <UpcomingExamCard
              level={dashboardLevel}
              upcoming={dashboard?.upcoming_exam ?? null}
              totalTimeMinutes={totalTimeMinutes}
              onChanged={loadDashboard}
            />
            <PredictedScoreCard predicted={dashboard?.predicted ?? null} />
          </div>
          <WeakMondaiCard items={dashboard?.weak_mondai ?? []} />
        </>
      )}
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
