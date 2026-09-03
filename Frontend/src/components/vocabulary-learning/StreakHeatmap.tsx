import { HeatmapDay } from "../../services/vocabularyLearningApi";

function levelClass(count: number): string {
  if (count <= 0) return "bg-gray-200 dark:bg-gray-700";
  if (count < 5) return "bg-brand-200 dark:bg-brand-900";
  if (count < 10) return "bg-brand-400 dark:bg-brand-700";
  if (count < 20) return "bg-brand-500 dark:bg-brand-600";
  return "bg-brand-600 dark:bg-brand-400";
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const LEGEND_LEVELS = [0, 1, 5, 10, 20];
// Row order matches the data: the backend always aligns the heatmap window
// to start on a Sunday (see learning.py's _heatmap_start).
const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** GitHub-style contribution grid: `days` must be a dense, chronologically
 * ordered list starting on a Sunday, one entry per calendar day — CSS grid's
 * column-first auto-placement then lays out 7-day columns with no reshaping
 * needed on this end. */
export default function StreakHeatmap({ days }: { days: HeatmapDay[] }) {
  if (days.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1">
          {DAY_LABELS.map((label) => (
            <span
              key={label}
              className="flex h-3 w-6 items-center text-[9px] leading-none text-gray-400 dark:text-gray-500"
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className="grid gap-1 overflow-x-auto"
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
