import { HeatmapDay } from "../../services/vocabularyLearningApi";

function levelClass(count: number): string {
  if (count <= 0) return "bg-gray-100 dark:bg-gray-800";
  if (count < 5) return "bg-teal-200 dark:bg-teal-900";
  if (count < 10) return "bg-teal-400 dark:bg-teal-700";
  if (count < 20) return "bg-teal-500 dark:bg-teal-600";
  return "bg-teal-600 dark:bg-teal-400";
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const LEGEND_LEVELS = [0, 1, 5, 10, 20];

/** GitHub-style contribution grid: `days` must be a dense, chronologically
 * ordered list starting on a Sunday, one entry per calendar day — CSS grid's
 * column-first auto-placement then lays out 7-day columns with no reshaping
 * needed on this end. */
export default function StreakHeatmap({ days }: { days: HeatmapDay[] }) {
  if (days.length === 0) return null;

  return (
    <div className="space-y-2">
      <div
        className="grid gap-1"
        style={{ gridTemplateRows: "repeat(7, 1fr)", gridAutoFlow: "column", gridAutoColumns: "12px" }}
      >
        {days.map((d) => (
          <div
            key={d.date}
            title={`${formatDate(d.date)}: ${d.count} từ`}
            className={`h-3 w-3 rounded-sm ${levelClass(d.count)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <span>Ít</span>
        {LEGEND_LEVELS.map((level) => (
          <span key={level} className={`h-3 w-3 rounded-sm ${levelClass(level)}`} />
        ))}
        <span>Nhiều</span>
      </div>
    </div>
  );
}
