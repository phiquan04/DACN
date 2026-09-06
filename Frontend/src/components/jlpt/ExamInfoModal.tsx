import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import {
  ExamRanking, ExamRankingEntry, JlptLevel, LevelStructure, PublishedExamSummary, SECTION_LABELS,
  fetchExamRanking, fetchStructure,
} from "../../services/jlptApi";
import { CheckCircleIcon, GroupIcon, TaskIcon, TimeIcon } from "../../icons";
import { TrophyIcon } from "../../icons/custom";
import { formatDateTime } from "./dateFormat";

const RANKING_PREVIEW = 5;
const TOTAL_MAX = 180;
const SECTION_FLOOR = 19;
const SECTION_MAX = 60;

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-gray-50 px-3 py-3 text-center dark:bg-gray-800">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-white/90">{value}</p>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500">{hint}</p>}
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}

const RANK_MEDAL_CLASSES = [
  "bg-gradient-to-br from-amber-300 to-amber-500",
  "bg-gradient-to-br from-gray-300 to-gray-400",
  "bg-gradient-to-br from-orange-300 to-orange-500",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${RANK_MEDAL_CLASSES[rank - 1]}`}>
        <TrophyIcon className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {rank}
    </div>
  );
}

function Avatar({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function RankingRow({ entry }: { entry: ExamRankingEntry }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        entry.is_me ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30" : ""
      }`}
    >
      <RankBadge rank={entry.rank} />
      <Avatar url={entry.avatar_url} name={entry.username} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-gray-800 dark:text-white/90">
          <span className="truncate">{entry.username}</span>
          {entry.is_verified && <CheckCircleIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
          {entry.is_me && <span className="shrink-0 text-xs font-normal text-brand-600 dark:text-brand-300">(bạn)</span>}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {entry.duration_minutes != null ? `${entry.duration_minutes} phút · ` : ""}
          {formatDateTime(entry.submitted_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
          {entry.score}/{entry.total_questions}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{entry.percent}%</p>
      </div>
    </div>
  );
}

export default function ExamInfoModal({
  exam,
  onClose,
  onStart,
  onViewHistory,
}: {
  exam: PublishedExamSummary;
  onClose: () => void;
  onStart: (examId: number) => void;
  onViewHistory: () => void;
}) {
  const [structure, setStructure] = useState<LevelStructure | null>(null);
  const [ranking, setRanking] = useState<ExamRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllRanking, setShowAllRanking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setShowAllRanking(false);
    Promise.all([fetchStructure(exam.level as JlptLevel), fetchExamRanking(exam.id)])
      .then(([s, r]) => {
        if (cancelled) return;
        setStructure(s);
        setRanking(r);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exam.id, exam.level]);

  const mondaiCount = structure?.sections.reduce((sum, s) => sum + s.mondai.length, 0) ?? null;
  const totalTime = structure?.total_time_minutes ?? exam.total_time_minutes ?? null;
  const sectionTimes = structure?.sections.map((s) => s.time_minutes).filter((t): t is number => !!t) ?? [];

  const visibleEntries = ranking ? (showAllRanking ? ranking.entries : ranking.entries.slice(0, RANKING_PREVIEW)) : [];

  return (
    <Modal isOpen onClose={onClose} className="m-4 max-h-[85vh] max-w-3xl overflow-y-auto p-6">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          {exam.level}
        </span>
        {(exam.year || exam.month) && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {exam.month ? `Kỳ tháng ${exam.month}` : ""}
            {exam.year ? ` ${exam.year}` : ""}
          </span>
        )}
      </div>
      <h2 lang="ja" className="mt-1.5 pr-8 text-lg font-semibold text-gray-800 dark:text-white/90">
        {exam.title}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={<TimeIcon className="h-4 w-4" />}
          label="Tổng thời gian"
          value={totalTime ? `${totalTime} phút` : "—"}
          hint={sectionTimes.length > 1 ? `(${sectionTimes.map((t) => `${t}p`).join("+")})` : undefined}
        />
        <StatTile
          icon={<TaskIcon className="h-4 w-4" />}
          label="Số lượng câu"
          value={`${exam.question_count} câu`}
          hint={mondaiCount != null ? `(${mondaiCount} mondai)` : undefined}
        />
        <StatTile
          icon={<CheckCircleIcon className="h-4 w-4" />}
          label="Điểm đậu yêu cầu"
          value={ranking?.pass_total ? `≥ ${ranking.pass_total}/${TOTAL_MAX}` : "—"}
          hint={`(Liệt ≥${SECTION_FLOOR}/${SECTION_MAX})`}
        />
        <StatTile
          icon={<GroupIcon className="h-4 w-4" />}
          label="Lượt thí sinh thi"
          value={ranking ? `${ranking.total_attempts.toLocaleString("vi-VN")} lượt` : "—"}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Cấu trúc đề & phân rã kỹ năng
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {structure?.sections.map((s, idx) => (
              <div key={s.section_type} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-100 text-[11px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {SECTION_LABELS[s.section_type]}
                  </span>
                  <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                    {s.time_minutes ? `${s.time_minutes} phút` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {s.mondai.map((m) => (
                    <div key={m.mondai_no} className="flex items-center justify-between gap-2 text-[11px]">
                      <span lang="ja" className="truncate text-gray-600 dark:text-gray-300">
                        問題{m.mondai_no}
                        {m.name ? ` — ${m.name}` : ""}
                      </span>
                      {m.question_count ? (
                        <span className="shrink-0 text-gray-400 dark:text-gray-500">{m.question_count} câu</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {(!structure || structure.sections.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có cấu trúc chi tiết cho đề này.</p>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <TrophyIcon className="h-4 w-4 text-amber-500" />
              Bảng xếp hạng
            </p>
            {ranking && ranking.entries.length > RANKING_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllRanking((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
              >
                {showAllRanking ? "Thu gọn" : "Xem tất cả"}
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-1">
            {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
            {!loading && ranking?.entries.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có ai làm đề này — hãy là người đầu tiên!</p>
            )}
            {visibleEntries.map((entry) => (
              <RankingRow key={entry.user_id} entry={entry} />
            ))}
            {ranking?.me && (
              <>
                <div className="my-1 border-t border-dashed border-gray-200 dark:border-gray-700" />
                <div className="flex items-center justify-between px-3">
                  <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Vị trí của bạn</span>
                  <button
                    type="button"
                    onClick={onViewHistory}
                    className="text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Lịch sử
                  </button>
                </div>
                <RankingRow entry={ranking.me} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Quay lại danh sách
        </button>
        <button
          type="button"
          onClick={() => onStart(exam.id)}
          className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-medium text-white hover:from-brand-600 hover:to-brand-700"
        >
          Bắt đầu làm bài ngay
        </button>
      </div>
    </Modal>
  );
}
