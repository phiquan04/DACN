import { ChevronRightIcon } from "./icons";

interface Props {
  current: string;
}

/** Breadcrumb shared by the three JLPT Content Bank pages (Cấu trúc đề /
 * Import đề / Duyệt đề). Navigation between them happens only via the
 * sidebar dropdown — no in-page page-switch controls here. */
export default function JLPTTabs({ current }: Props) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
      <span>Ngân hàng đề JLPT</span>
      <ChevronRightIcon className="h-3.5 w-3.5" />
      <span className="font-medium text-gray-800 dark:text-white/90">{current}</span>
    </nav>
  );
}
