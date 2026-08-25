import InputField from "../../../components/form/input/InputField";

interface SearchBarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function SearchBar({ searchTerm, onSearchTermChange, loading, onSubmit }: SearchBarProps) {
  return (
    <form onSubmit={onSubmit} className="flex gap-3 items-center">
      <div className="relative flex-1">
        <InputField
          id="search"
          type="text"
          placeholder="Nhập từ tiếng Nhật (kanji, hiragana)..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          disabled={loading}
          className="!rounded-full !pl-5 !pr-12 !py-3 !border-outline-variant/60 dark:!border-gray-700"
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
        type="submit"
        disabled={loading}
        className="shrink-0 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 dark:bg-primary-container dark:hover:bg-brand-700"
      >
        {loading ? "Đang tìm..." : "Tra cứu"}
      </button>
    </form>
  );
}
