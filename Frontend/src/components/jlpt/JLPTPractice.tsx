import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { getStoredUser } from "../../services/authApi";
import { getUserProfile, UserProfile } from "../../services/userApi";
import {
  AttemptHistoryItem,
  JLPT_LEVELS,
  JlptDashboard,
  JlptLevel,
  LevelAverage,
  PublishedExamSummary,
  SubmitAttemptResult,
  TakeExam,
  fetchAttemptDetail,
  fetchDashboard,
  fetchExamToTake,
  fetchLevelAverages,
  fetchMyAttempts,
  fetchPublishedExams,
  submitAttempt,
} from "../../services/jlptApi";
import AttemptHistoryList from "./AttemptHistoryList";
import ExamBrowseList from "./ExamBrowseList";
import ExamCountdownCard from "./ExamCountdownCard";
import ExamFilterBar, { ExamStatusFilter } from "./ExamFilterBar";
import ExamResultView from "./ExamResultView";
import ExamStatsSidebar from "./ExamStatsSidebar";
import PracticeTabs, { PracticeTab } from "./PracticeTabs";
import PredictedScoreCard from "./PredictedScoreCard";
import RegistrationInfoCard from "./RegistrationInfoCard";
import TakeExamView from "./TakeExamView";
import { clearExamDraft } from "./examDraft";
import { useSetUrlParams, useUrlEnum, useUrlNumber, useUrlSearchInput, useUrlString } from "../../hooks/useUrlState";
import WeakMondaiCard from "./WeakMondaiCard";

const DEFAULT_LEVEL: JlptLevel = "N3";

function isJlptLevel(value?: string | null): value is JlptLevel {
  return !!value && (JLPT_LEVELS as string[]).includes(value);
}

export default function JLPTPractice() {
  const { showToast } = useToast();
  const currentUser = getStoredUser();

  // Tab, bộ lọc, đề đang làm (?exam=) và bài làm đang xem (?attempt=) nằm trên
  // URL -> tải lại trang / Back / gửi link đều giữ nguyên chỗ đang xem.
  const setUrlParams = useSetUrlParams();
  const [tab, setTab] = useUrlEnum<PracticeTab>("tab", ["exams", "history"], "exams");
  // "" = learner hasn't picked a level yet -> fall back to their target level.
  const [pickedLevel, setPickedLevel] = useUrlString("level");
  const [search, setSearch] = useUrlSearchInput("search");
  const [yearParam, setYearParam] = useUrlNumber("year", null);
  const year: number | "ALL" = yearParam ?? "ALL";
  const setYear = (y: number | "ALL") => setYearParam(y === "ALL" ? null : y);
  const [status, setStatus] = useUrlEnum<ExamStatusFilter>(
    "status",
    ["all", "not_done", "done", "passed", "failed"],
    "all"
  );
  const [examParam] = useUrlNumber("exam", null);
  const [attemptParam] = useUrlNumber("attempt", null);

  const [exams, setExams] = useState<PublishedExamSummary[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [dashboard, setDashboard] = useState<JlptDashboard | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [averages, setAverages] = useState<LevelAverage[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);

  const [activeExam, setActiveExam] = useState<TakeExam | null>(null);
  const [result, setResult] = useState<SubmitAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingAttemptDetail, setLoadingAttemptDetail] = useState(false);

  const targetLevel = isJlptLevel(profile?.target_jlpt_level) ? (profile!.target_jlpt_level as JlptLevel) : undefined;
  const level: JlptLevel | "ALL" =
    pickedLevel === "ALL" || isJlptLevel(pickedLevel) ? (pickedLevel as JlptLevel | "ALL") : targetLevel ?? "ALL";
  const dashboardLevel: JlptLevel = level === "ALL" ? targetLevel ?? DEFAULT_LEVEL : level;

  // Guards against a race where the initial "ALL" fetch (issued before the
  // learner's profile/target level is known) resolves after a later,
  // target-level-filtered fetch and overwrites it with the stale, unfiltered
  // list — which is why the exam list used to need a manual page reload to
  // show the right exams after the target level loaded in.
  const examsRequestRef = useRef(0);

  const loadExams = async (lv: JlptLevel | "ALL") => {
    const requestId = ++examsRequestRef.current;
    setLoadingExams(true);
    try {
      const data = await fetchPublishedExams(lv === "ALL" ? undefined : lv);
      if (requestId === examsRequestRef.current) setExams(data);
    } finally {
      if (requestId === examsRequestRef.current) setLoadingExams(false);
    }
  };

  const loadDashboard = () => {
    if (!currentUser) return;
    fetchDashboard(dashboardLevel).then(setDashboard);
  };

  const loadAttempts = () => {
    if (!currentUser) return;
    setLoadingAttempts(true);
    Promise.all([fetchMyAttempts(), fetchLevelAverages()])
      .then(([a, avg]) => {
        setAttempts(a);
        setAverages(avg);
      })
      .finally(() => setLoadingAttempts(false));
  };

  useEffect(() => {
    loadExams(level);
  }, [level]);

  useEffect(() => {
    loadDashboard();
    loadAttempts();
    if (currentUser) getUserProfile().then(setProfile).catch(() => {});
    // currentUser comes from getStoredUser(), which JSON.parses localStorage
    // on every render and so returns a new object reference each time —
    // depending on the object itself would re-run this effect (and refetch)
    // on every render, forever. Depend on the primitive id instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, dashboardLevel]);

  // Until the learner picks a level themselves, `level` follows their target
  // level once the profile loads (see its derivation above).
  const handleLevelChange = (lv: JlptLevel | "ALL") => setPickedLevel(lv);

  // ?exam= / ?attempt= -> load what the URL points at. Covers starting an exam,
  // opening an attempt, a reload mid-exam (answers come back from the draft),
  // and Back/Forward between them.
  useEffect(() => {
    let cancelled = false;
    if (examParam) {
      if (activeExam?.id === examParam && !result) return;
      setResult(null);
      fetchExamToTake(examParam)
        .then((exam) => {
          if (!cancelled) setActiveExam(exam);
        })
        .catch(() => {
          // reported globally
        });
    } else if (attemptParam) {
      if (result?.attempt_id === attemptParam) return;
      setLoadingAttemptDetail(true);
      fetchAttemptDetail(attemptParam)
        .then((detail) => {
          if (cancelled) return;
          setActiveExam(detail.exam);
          setResult(detail.result);
        })
        .catch(() => {
          // reported globally
        })
        .finally(() => {
          if (!cancelled) setLoadingAttemptDetail(false);
        });
    } else if (activeExam || result) {
      setActiveExam(null);
      setResult(null);
      loadExams(level);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examParam, attemptParam]);

  const years = useMemo(() => {
    const set = new Set<number>();
    exams.forEach((e) => {
      if (e.year) set.add(e.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [exams]);

  const passedExamIds = useMemo(() => new Set(attempts.filter((a) => a.is_pass).map((a) => a.exam_id)), [attempts]);

  const filteredExams = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exams.filter((e) => {
      if (query) {
        const haystack = `${e.title} ${e.level} ${e.year ?? ""} ${e.month ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (year !== "ALL" && e.year !== year) return false;
      if (status === "not_done" && e.attempt_count > 0) return false;
      if (status === "done" && e.attempt_count === 0) return false;
      if (status === "passed" && !passedExamIds.has(e.id)) return false;
      if (status === "failed" && (e.attempt_count === 0 || passedExamIds.has(e.id))) return false;
      return true;
    });
  }, [exams, search, year, status, passedExamIds]);

  const recommendedExamId = useMemo(() => {
    if (!currentUser) return null;
    const goalLevel = targetLevel ?? dashboardLevel;
    return exams.find((e) => e.level === goalLevel && e.attempt_count === 0)?.id ?? null;
  }, [exams, currentUser, targetLevel, dashboardLevel]);

  const attemptsForRate = level === "ALL" ? attempts : attempts.filter((a) => a.level === level);
  const passRate =
    attemptsForRate.length > 0
      ? Math.round((attemptsForRate.filter((a) => a.is_pass).length / attemptsForRate.length) * 100)
      : null;
  const attemptedExamsCount = exams.filter((e) => e.attempt_count > 0).length;

  const examStats = useMemo(() => {
    const total = filteredExams.length;
    const done = filteredExams.filter((e) => e.attempt_count > 0).length;
    const passed = filteredExams.filter((e) => passedExamIds.has(e.id)).length;
    return { total, done, notDone: total - done, passed, failed: done - passed, inProgress: 0 };
  }, [filteredExams, passedExamIds]);

  const handleStart = (examId: number) => setUrlParams({ exam: examId, attempt: null }, "push");

  const handleSubmit = async (
    answers: { question_id: number; selected_choice_no: number | null }[],
    elapsedSeconds: number
  ) => {
    if (!activeExam) return;
    if (!currentUser) {
      showToast("Vui lòng đăng nhập để nộp bài và lưu kết quả", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitAttempt(activeExam.id, answers, elapsedSeconds);
      clearExamDraft(activeExam.id);
      setResult(res);
      // Thay ?exam= bằng ?attempt= (replace): tải lại trang sẽ hiện kết quả,
      // không mở lại đề; Back quay về danh sách đề thay vì về bài vừa nộp.
      setUrlParams({ exam: null, attempt: res.attempt_id }, "replace");
      loadDashboard();
      loadAttempts();
    } catch {
      // reported globally
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToList = () => setUrlParams({ exam: null, attempt: null }, "push");

  const handleCancelExam = () => {
    if (activeExam) clearExamDraft(activeExam.id);
    handleBackToList();
  };

  const handleSelectAttempt = (attemptId: number) => setUrlParams({ exam: null, attempt: attemptId }, "push");

  if (examParam && activeExam?.id === examParam && !result) {
    return (
      <TakeExamView
        // remount per exam so the draft for *this* exam is the one restored
        key={activeExam.id}
        exam={activeExam}
        onSubmit={handleSubmit}
        onCancel={handleCancelExam}
        submitting={submitting}
      />
    );
  }

  if (attemptParam && activeExam && result?.attempt_id === attemptParam) {
    // Mở từ tab Lịch sử -> nút quay lại về Lịch sử; vừa nộp xong -> về danh sách đề.
    return tab === "history" ? (
      <ExamResultView exam={activeExam} result={result} onBack={handleBackToList} backLabel="Quay lại lịch sử" />
    ) : (
      <ExamResultView exam={activeExam} result={result} onBack={handleBackToList} />
    );
  }

  return (
    <div className="space-y-5">
      {currentUser && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <RegistrationInfoCard level={dashboardLevel} upcoming={dashboard?.upcoming_exam ?? null} onChanged={loadDashboard} />
            <ExamCountdownCard upcoming={dashboard?.upcoming_exam ?? null} predicted={dashboard?.predicted ?? null} />
            <PredictedScoreCard predicted={dashboard?.predicted ?? null} hasWeakMondai={(dashboard?.weak_mondai?.length ?? 0) > 0} />
          </div>
          <WeakMondaiCard items={dashboard?.weak_mondai ?? []} />
        </>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PracticeTabs active={tab} onChange={setTab} examCount={filteredExams.length} historyCount={attempts.length} />
          {currentUser && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>
                Đã làm: <span className="font-semibold text-gray-700 dark:text-gray-200">{attemptedExamsCount}/{exams.length}</span> đề
              </span>
              {passRate !== null && (
                <span>
                  Tỷ lệ đạt chuẩn: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{passRate}%</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <ExamFilterBar
          search={search}
          onSearchChange={setSearch}
          level={level}
          onLevelChange={handleLevelChange}
          targetLevel={targetLevel}
          year={year}
          onYearChange={setYear}
          years={years}
          status={status}
          onStatusChange={setStatus}
        />

        {tab === "exams" ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ExamBrowseList
                exams={filteredExams}
                loading={loadingExams}
                recommendedExamId={recommendedExamId}
                onStart={handleStart}
                onViewHistory={() => setTab("history")}
              />
            </div>
            <ExamStatsSidebar {...examStats} />
          </div>
        ) : (
          <>
            {loadingAttemptDetail && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải chi tiết bài làm...</p>}
            <AttemptHistoryList
              level={level}
              attempts={attempts}
              averages={averages}
              loading={loadingAttempts}
              onSelectAttempt={handleSelectAttempt}
            />
          </>
        )}
      </div>
    </div>
  );
}
