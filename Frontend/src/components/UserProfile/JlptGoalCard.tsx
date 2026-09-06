import { Link } from "react-router";
import { JlptLevel, ScoreBreakdown, UpcomingExam } from "../../services/jlptApi";
import { formatVietnameseDate } from "../jlpt/dateFormat";
import { CalenderIcon, ChevronDownIcon } from "../../icons";
import { FlagIcon, GlobeIcon } from "../../icons/custom";

export default function JlptGoalCard({
  level,
  upcoming,
  predicted,
  loading,
}: {
  level: JlptLevel;
  upcoming: UpcomingExam | null;
  predicted: ScoreBreakdown | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      </div>
    );
  }

  if (!upcoming) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-600 dark:bg-gray-900">
        <FlagIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Bạn chưa đặt kỳ thi mục tiêu.</p>
        <Link
          to="/jlpt-practice"
          className="mt-1 rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600"
        >
          Đặt kỳ thi mục tiêu
        </Link>
      </div>
    );
  }

  const progressPct = predicted
    ? Math.max(4, Math.min(100, Math.round((predicted.total / predicted.pass_total) * 100)))
    : 4;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <FlagIcon className="h-3.5 w-3.5 text-brand-500" /> Mục tiêu JLPT
        </h4>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          Còn {upcoming.days_left} ngày
        </span>
      </div>

      <p className="mt-2 text-base font-semibold text-gray-800 dark:text-white/90">Kỳ thi {level} sắp tới</p>

      <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-800">
        <CalenderIcon className="h-4 w-4 shrink-0 text-brand-500" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-200">
            {formatVietnameseDate(upcoming.schedule.exam_date)}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-400 dark:text-gray-500">
            <GlobeIcon className="h-3 w-3 shrink-0" /> {upcoming.location ?? "Chưa chọn địa điểm"}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Tiến độ ôn thi</span>
          <span className="font-semibold text-gray-800 dark:text-white/90">{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <Link
        to="/jlpt-practice"
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
      >
        Xem kế hoạch ôn thi <ChevronDownIcon className="h-3.5 w-3.5 -rotate-90" />
      </Link>
    </div>
  );
}
