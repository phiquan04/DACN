import { useEffect, useRef, useState } from "react";
import { JLPT_LEVELS, JlptLevel } from "../../services/jlptApi";
import { FilterIcon, SearchIcon } from "../../icons/custom";

export type ExamStatusFilter = "all" | "not_done" | "done" | "passed" | "failed";

const STATUS_OPTIONS: { value: ExamStatusFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "not_done", label: "Chưa làm" },
  { value: "done", label: "Đã làm" },
  { value: "passed", label: "Đạt chuẩn" },
  { value: "failed", label: "Chưa đạt" },
];

export default function ExamFilterBar({
  search,
  onSearchChange,
  level,
  onLevelChange,
  targetLevel,
  year,
  onYearChange,
  years,
  status,
  onStatusChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  level: JlptLevel | "ALL";
  onLevelChange: (level: JlptLevel | "ALL") => void;
  targetLevel?: JlptLevel;
  year: number | "ALL";
  onYearChange: (year: number | "ALL") => void;
  years: number[];
  status: ExamStatusFilter;
  onStatusChange: (status: ExamStatusFilter) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [panelOpen]);

  const selectClass =
    "h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200";

  const activeCount = (year !== "ALL" ? 1 : 0) + (status !== "all" ? 1 : 0);
  const summaryLabel = [
    year !== "ALL" ? String(year) : null,
    status !== "all" ? STATUS_OPTIONS.find((o) => o.value === status)?.label : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="relative w-full max-w-xs">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm kiếm đề thi (VD: 2023, N3, đề luyện tập số 2...)"
          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-400/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Chọn cấp độ JLPT"
          value={level}
          onChange={(e) => onLevelChange(e.target.value as JlptLevel | "ALL")}
          className={selectClass}
        >
          <option value="ALL">Tất cả cấp độ</option>
          {JLPT_LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {lv}
              {lv === targetLevel ? " (Mục tiêu của bạn)" : ""}
            </option>
          ))}
        </select>

        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setPanelOpen((o) => !o)}
            className={`flex h-11 items-center gap-2 rounded-lg border px-3 text-sm ${
              activeCount > 0
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
                : "border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            <FilterIcon className="h-4 w-4" />
            {summaryLabel || "Năm & trạng thái"}
            {activeCount > 0 && (
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </button>

          {panelOpen && (
            <div className="absolute left-0 top-full z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Năm
                  </label>
                  <select
                    aria-label="Chọn năm"
                    value={year}
                    onChange={(e) => onYearChange(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
                    className={`${selectClass} w-full`}
                  >
                    <option value="ALL">Tất cả các năm</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    Trạng thái
                  </label>
                  <select
                    aria-label="Lọc theo trạng thái làm bài"
                    value={status}
                    onChange={(e) => onStatusChange(e.target.value as ExamStatusFilter)}
                    className={`${selectClass} w-full`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onYearChange("ALL");
                      onStatusChange("all");
                    }}
                    className="self-start text-xs font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
