import { useEffect, useRef, useState } from "react";
import { Curriculum, VocabCategory } from "../../services/vocabularyApi";
import { FilterIcon } from "../admin-jlpt/icons";

export interface VocabularySetFilterValues {
  curriculumId: number | "";
  categoryId: number | "";
  status: "" | "draft" | "processing" | "failed" | "published";
}

export const EMPTY_FILTERS: VocabularySetFilterValues = {
  curriculumId: "",
  categoryId: "",
  status: "",
};

const STATUS_OPTIONS: { value: VocabularySetFilterValues["status"]; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "draft", label: "Nháp" },
  { value: "processing", label: "Đang xử lý" },
  { value: "failed", label: "Lỗi" },
  { value: "published", label: "Đã publish" },
];

function countActive(v: VocabularySetFilterValues): number {
  return Object.values(v).filter((x) => x !== "").length;
}

interface Props {
  curriculums: Curriculum[];
  categories: VocabCategory[];
  value: VocabularySetFilterValues;
  onApply: (v: VocabularySetFilterValues) => void;
}

/** Every filter condition (curriculum, category, lock status, publish
 * status) lives behind one "Bộ lọc" button instead of a row of separate
 * dropdowns — the admin picks several conditions in the popover and applies
 * them all at once instead of the list re-filtering after every click. */
export default function VocabularySetFilters({ curriculums, categories, value, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [staged, setStaged] = useState<VocabularySetFilterValues>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const handleOpen = () => {
    setStaged(value);
    setOpen(true);
  };

  const handleApply = () => {
    onApply(staged);
    setOpen(false);
  };

  const handleReset = () => {
    setStaged(EMPTY_FILTERS);
    onApply(EMPTY_FILTERS);
    setOpen(false);
  };

  const activeCount = countActive(value);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        <FilterIcon className="h-4 w-4" />
        Bộ lọc
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Bộ giáo trình
              </label>
              <select
                value={staged.curriculumId}
                onChange={(e) =>
                  setStaged((s) => ({ ...s, curriculumId: e.target.value === "" ? "" : Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="">Tất cả</option>
                {curriculums.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Danh mục nội dung
              </label>
              <select
                value={staged.categoryId}
                onChange={(e) =>
                  setStaged((s) => ({ ...s, categoryId: e.target.value === "" ? "" : Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                <option value="">Tất cả</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Trạng thái xuất bản
              </label>
              <select
                value={staged.status}
                onChange={(e) =>
                  setStaged((s) => ({ ...s, status: e.target.value as VocabularySetFilterValues["status"] }))
                }
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white/90"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-between gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Xóa bộ lọc
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
