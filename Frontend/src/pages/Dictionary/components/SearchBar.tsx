import InputField from "../../../components/form/input/InputField";
import { PencilIcon } from "../../../icons/custom";

interface SearchBarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onOpenDraw: () => void;
}

export default function SearchBar({ searchTerm, onSearchTermChange, loading, onSubmit, onOpenDraw }: SearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 sm:gap-3">
      <div className="relative min-w-0 flex-1">
        <InputField
          id="search"
          type="text"
          placeholder="Nhập từ tiếng Nhật"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          disabled={loading}
          className="!rounded-lg !pl-5 !pr-12 !py-3 !border-outline-variant/60 dark:!border-gray-700"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline dark:text-gray-500"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <button
        type="button"
        onClick={onOpenDraw}
        disabled={loading}
        title="Vẽ chữ Hán để tìm kiếm"
        className="shrink-0 flex items-center gap-1.5 rounded-lg border border-outline-variant/60 px-4 py-3 text-sm font-medium text-on-surface-variant transition hover:border-teal-500 hover:text-teal-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:text-teal-400"
      >
        <PencilIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Vẽ</span>
      </button>
      <button
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 sm:px-6 text-sm font-semibold text-white shadow-theme-xs transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-50"
      >
        {loading ? "Đang tìm..." : "Tra cứu"}
      </button>
    </form>
  );
}
