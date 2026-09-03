import { ScoreBreakdown } from "../../services/jlptApi";
import SectionScoreBars from "./SectionScoreBars";

export default function PredictedScoreCard({ predicted }: { predicted: ScoreBreakdown | null }) {
  if (!predicted) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Điểm dự kiến so với mốc đậu</p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Làm thử một đề đầy đủ để xem điểm dự kiến của bạn so với mốc đậu.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Điểm dự kiến so với mốc đậu
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            predicted.is_pass
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
          }`}
        >
          {predicted.is_pass ? "Dự kiến đậu" : "Dự kiến rớt"}
        </span>
      </div>

      <p className="mt-2 text-3xl font-bold text-gray-800 dark:text-white/90">
        {predicted.total}
        <span className="text-base font-medium text-gray-400 dark:text-gray-500"> / {predicted.total_max}</span>
        <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
          · cần {predicted.pass_total} để đậu
        </span>
      </p>

      <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${Math.min(100, (predicted.total / predicted.total_max) * 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-gray-400 dark:bg-gray-500"
          style={{ left: `${Math.min(100, (predicted.pass_total / predicted.total_max) * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        Đậu JLPT cần đủ hai điều kiện: tổng ≥ {predicted.pass_total} và mỗi phần ≥{" "}
        {predicted.sections[0]?.floor ?? 19} điểm.
      </p>

      <div className="mt-4">
        <SectionScoreBars sections={predicted.sections} />
      </div>
    </div>
  );
}
