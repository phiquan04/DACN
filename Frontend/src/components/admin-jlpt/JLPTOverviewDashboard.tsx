import { useEffect, useState } from "react";
import { Link } from "react-router";
import StatCard from "../admin-vocabulary/StatCard";
import { CheckIcon, ClockIcon, LayersIcon, TrophyIcon } from "../../icons/custom";
import { ADMIN_PRIMARY_GRADIENT } from "../../utils/adminStyles";
import {
  ExamSummary,
  JLPT_LEVELS,
  JlptLevel,
  fetchAdminExams,
  fetchStructureSummaries,
} from "../../services/jlptApi";
import JLPTQuickActionsCard from "./JLPTQuickActionsCard";
import JLPTLevelProgressCard, { LevelProgressItem } from "./JLPTLevelProgressCard";
import JLPTRecentExamsCard from "./JLPTRecentExamsCard";

export default function JLPTOverviewDashboard() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [configuredLevels, setConfiguredLevels] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [examList, structures] = await Promise.all([fetchAdminExams(), fetchStructureSummaries()]);
        if (cancelled) return;
        setExams(examList);
        setConfiguredLevels(structures.filter((s) => s.is_configured).length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-admin-body">Đang tải...</p>;
  }

  const totalQuestions = exams.reduce((sum, e) => sum + e.question_count, 0);
  const publishedQuestions = exams
    .filter((e) => e.status === "published")
    .reduce((sum, e) => sum + e.question_count, 0);
  const pendingQuestions = exams.reduce((sum, e) => sum + (e.question_count - e.reviewed_count), 0);
  const completedExams = exams.filter((e) => e.status === "published").length;
  const pendingReviewExams = exams.filter((e) => e.status !== "published").length;

  const levelProgress: LevelProgressItem[] = JLPT_LEVELS.map((level: JlptLevel) => {
    const levelExams = exams.filter((e) => e.level === level);
    const total = levelExams.reduce((sum, e) => sum + e.question_count, 0);
    const reviewed = levelExams.reduce((sum, e) => sum + e.reviewed_count, 0);
    return {
      level,
      totalQuestions: total,
      percentReady: total > 0 ? Math.round((reviewed / total) * 100) : 0,
    };
  });

  const recentExams = [...exams]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          <Link
            to="/admin/jlpt-content/review"
            className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input bg-white px-4 py-2.5 text-sm font-medium text-admin-body hover:bg-admin-fill"
          >
            Duyệt đề
          </Link>
          <Link
            to="/admin/jlpt-content/import"
            className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2.5 text-sm font-medium text-white shadow-[0_5px_12px_rgba(49,93,206,0.22)] ${ADMIN_PRIMARY_GRADIENT}`}
          >
            Import đề
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tổng câu hỏi" value={totalQuestions} icon={<LayersIcon />} tone="info" />
        <StatCard label="Đã xuất bản" value={publishedQuestions} icon={<CheckIcon />} tone="success" />
        <StatCard label="Chờ duyệt" value={pendingQuestions} icon={<ClockIcon />} tone="pending" />
        <StatCard label="Đề thi hoàn chỉnh" value={completedExams} icon={<TrophyIcon />} tone="neutral" />
      </div>

      <JLPTQuickActionsCard
        configuredLevels={configuredLevels}
        totalLevels={JLPT_LEVELS.length}
        pendingReviewExams={pendingReviewExams}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <JLPTLevelProgressCard items={levelProgress} />
        <JLPTRecentExamsCard exams={recentExams} />
      </div>
    </div>
  );
}
