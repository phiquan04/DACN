import { ScoreBreakdown } from "../../services/jlptApi";
import { TrendingUpIcon } from "../../icons/custom";
import { CheckCircleIcon } from "../../icons";

const RING_TRACK = "rgba(148, 163, 184, 0.25)";

function ScoreRing({ percent }: { percent: number }) {
  return (
    <div
      className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#4a6ba3 ${percent}%, ${RING_TRACK} ${percent}%)` }}
    >
      <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white dark:bg-gray-900">
        <span className="text-sm font-bold text-gray-800 dark:text-white/90">{percent}%</span>
      </div>
    </div>
  );
}

function SectionRow({ name, score, max, aboveFloor }: { name: string; score: number; max: number; aboveFloor: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-600 dark:text-gray-300">{name}</span>
      <span className="flex shrink-0 items-center gap-1.5 font-medium">
        <span className="text-gray-800 dark:text-white/90">
          {score}/{max}
        </span>
        <span
          className={
            aboveFloor
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }
        >
          ({aboveFloor ? "Thế mạnh" : "Cần rèn luyện"})
        </span>
      </span>
    </div>
  );
}

export default function PredictedScoreCard({
  predicted,
  hasWeakMondai,
}: {
  predicted: ScoreBreakdown | null;
  hasWeakMondai: boolean;
}) {
  if (!predicted) {
    return (
      <div className="flex h-full flex-col justify-center rounded-xl border border-gray-200 bg-white p-5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <TrendingUpIcon className="h-4 w-4 text-brand-500" />
          Dự báo AI Manabi
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Làm thử một đề đầy đủ để xem điểm dự kiến của bạn so với mốc đậu.
        </p>
      </div>
    );
  }

  const goalPercent = Math.max(4, Math.min(100, Math.round((predicted.total / predicted.pass_total) * 100)));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        <TrendingUpIcon className="h-3.5 w-3.5 text-brand-500" />
        Dự báo AI Manabi
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-gray-800 dark:text-white/90">
            {predicted.total}
            <span className="text-base font-medium text-gray-400 dark:text-gray-500"> / {predicted.total_max} điểm</span>
          </p>
          <p
            className={`mt-1 flex items-center gap-1 text-xs font-medium ${
              predicted.is_pass ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {predicted.is_pass && <CheckCircleIcon className="h-3.5 w-3.5" />}
            {predicted.is_pass
              ? `Vượt mốc đỗ (${predicted.pass_total} điểm)`
              : `Cần thêm ${Math.max(0, predicted.pass_total - predicted.total)} điểm để đạt mốc đỗ`}
          </p>
        </div>
        <ScoreRing percent={goalPercent} />
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {predicted.sections.map((s) => (
          <SectionRow key={s.section_type} name={s.name} score={s.score} max={s.max} aboveFloor={s.above_floor} />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5 text-[11px] dark:border-gray-800">
        <span className="text-gray-400 dark:text-gray-500">Dựa trên lần làm bài tốt nhất của bạn</span>
        {hasWeakMondai && (
          <button
            type="button"
            onClick={() => document.getElementById("jlpt-weak-mondai")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="shrink-0 font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Chi tiết phân tích
          </button>
        )}
      </div>
    </div>
  );
}
