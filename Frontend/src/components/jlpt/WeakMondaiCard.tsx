import { WeakMondai } from "../../services/jlptApi";

export default function WeakMondaiCard({ items }: { items: WeakMondai[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Dạng 問題 bạn hay sai</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">30 ngày gần nhất</span>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        {items.map((w) => (
          <div
            key={`${w.section_type}-${w.mondai_no}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-3.5 py-2.5 dark:border-gray-700"
          >
            <div className="min-w-0">
              <p lang="ja" className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                {w.section_name} 問題{w.mondai_no} {w.mondai_name ?? ""}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                sai {w.wrong_count} câu
              </p>
            </div>
            <div className="flex w-32 shrink-0 items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${w.percent_correct}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right text-xs font-semibold text-rose-600 dark:text-rose-400">
                {w.percent_correct}% đúng
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
