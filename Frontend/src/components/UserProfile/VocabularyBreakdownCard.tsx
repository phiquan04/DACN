import { Link } from "react-router";
import { VocabularySetProgress } from "../../services/vocabularyLearningApi";
import { PieChartIcon } from "../../icons";
import { ArrowRightIcon } from "../../icons/custom";

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold text-gray-800 dark:text-white/90">{value.toLocaleString("vi-VN")}</span>
    </div>
  );
}

const COLORS = { learned: "#10b981", reviewing: "#4a6ba3", new: "#d1d5db" };

export default function VocabularyBreakdownCard({
  sets,
  loading,
}: {
  sets: VocabularySetProgress[];
  loading: boolean;
}) {
  const learned = sets.reduce((s, v) => s + v.learned_count, 0);
  const reviewing = sets.reduce((s, v) => s + v.reviewing_count, 0);
  const newCount = sets.reduce((s, v) => s + v.new_count, 0);
  const total = learned + reviewing + newCount;
  const touched = learned + reviewing;

  const learnedPct = total > 0 ? (learned / total) * 100 : 0;
  const reviewingPct = total > 0 ? (reviewing / total) * 100 : 0;
  const gradient =
    total > 0
      ? `conic-gradient(${COLORS.learned} 0% ${learnedPct}%, ${COLORS.reviewing} ${learnedPct}% ${
          learnedPct + reviewingPct
        }%, ${COLORS.new} ${learnedPct + reviewingPct}% 100%)`
      : `conic-gradient(${COLORS.new} 0% 100%)`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
          <PieChartIcon className="h-4 w-4 text-brand-500" /> Từ vựng
        </h4>
        <Link
          to="/vocabulary"
          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Xem chi tiết <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Kho từ vựng của bạn</p>

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      ) : (
        <div className="mt-4 flex items-center gap-5">
          <div
            className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
            style={{ background: gradient }}
          >
            <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full bg-white text-center dark:bg-gray-900">
              <span className="text-lg font-bold text-gray-800 dark:text-white/90">{touched.toLocaleString("vi-VN")}</span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">từ đã học</span>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            <Legend color={COLORS.learned} label="Đã nhớ" value={learned} />
            <Legend color={COLORS.reviewing} label="Đang học" value={reviewing} />
            <Legend color={COLORS.new} label="Chưa học" value={newCount} />
          </div>
        </div>
      )}
    </div>
  );
}
