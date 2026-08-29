import { Link, useLocation } from "react-router";
import { ChevronRightIcon } from "../admin-jlpt/icons";

const TABS = [
  { path: "/admin/vocabulary-content/lookups", label: "Giáo trình & Danh mục" },
  { path: "/admin/vocabulary-content/import", label: "Import bộ từ vựng" },
  { path: "/admin/vocabulary-content/review", label: "Duyệt bộ từ vựng" },
];

interface Props {
  current: string;
}

/** Breadcrumb + quick-switch pill tabs shared by the three Vocabulary
 * Content Bank pages, mirroring components/admin-jlpt/JLPTTabs.tsx. */
export default function VocabularyTabs({ current }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <span>Kho từ vựng</span>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-800 dark:text-white/90">{current}</span>
      </nav>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              pathname.startsWith(t.path)
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
