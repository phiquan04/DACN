import { Link, useLocation } from "react-router";
import { ChevronRightIcon } from "../../icons/custom";

const TABS = [
  { path: "/admin/jlpt-content/structure", label: "Cấu trúc đề" },
  { path: "/admin/jlpt-content/import", label: "Import đề" },
  { path: "/admin/jlpt-content/review", label: "Duyệt đề" },
];

interface Props {
  current: string;
}

/** Breadcrumb + quick-switch pill tabs shared by the three JLPT Content Bank
 * pages (Cấu trúc đề / Import đề / Duyệt đề) — each is now its own route
 * under /admin/jlpt-content, reachable both from the sidebar dropdown and
 * from these in-page tabs. */
export default function JLPTTabs({ current }: Props) {
  const { pathname } = useLocation();

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <span>Ngân hàng đề JLPT</span>
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
