import { SectionScore } from "../../services/jlptApi";

export default function SectionScoreBars({ sections }: { sections: SectionScore[] }) {
  return (
    <div className="flex flex-col gap-3">
      {sections.map((s) => (
        <div key={s.section_type}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700 dark:text-gray-200">{s.name}</span>
            <span className="font-semibold text-gray-800 dark:text-white/90">
              {s.score}/{s.max}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={`h-full rounded-full ${s.above_floor ? "bg-emerald-500" : "bg-rose-500"}`}
              style={{ width: `${Math.min(100, (s.score / s.max) * 100)}%` }}
            />
          </div>
          <p
            className={`mt-0.5 text-[11px] ${
              s.above_floor ? "text-gray-400 dark:text-gray-500" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {s.above_floor ? `Trên điểm sàn ${s.floor}` : `Dưới điểm sàn ${s.floor}`}
          </p>
        </div>
      ))}
    </div>
  );
}
