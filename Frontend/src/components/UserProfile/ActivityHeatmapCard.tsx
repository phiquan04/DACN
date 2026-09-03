import { StudyOverview } from "../../services/vocabularyLearningApi";
import StreakHeatmap from "../vocabulary-learning/StreakHeatmap";
import { TableIcon } from "../../icons";

export default function ActivityHeatmapCard({ overview, loading }: { overview: StudyOverview | null; loading: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:p-6">
      <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-white/90">
        <TableIcon className="h-4 w-4 text-brand-500" /> Hoạt động 12 tuần
      </h4>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
      ) : !overview || overview.heatmap.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu hoạt động.</p>
      ) : (
        <div className="overflow-x-auto">
          <StreakHeatmap days={overview.heatmap} />
        </div>
      )}
    </div>
  );
}
