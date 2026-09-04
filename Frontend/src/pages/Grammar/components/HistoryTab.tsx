import Pagination from "../../../components/ui/pagination";
import { getStoredUser } from "../../../services/authApi";
import type { GrammarHistoryItem, GrammarHistoryStatus } from "../../../services/grammarApi";
import { useGrammarHistory } from "../hooks/useGrammarHistory";
import HistoryDetailModal from "./HistoryDetailModal";
import { ArrowRightIcon, CheckIcon, ClockIcon } from "../../../icons/custom";

const STATUS_TABS: { value: GrammarHistoryStatus; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "changed", label: "Có lỗi" },
  { value: "unchanged", label: "Đúng hoàn toàn" },
];

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN");
}

/** Groups records by calendar day for the "2/9/2026 · 2 lần" section headers. Items already
 * arrive newest-first from the backend, so grouping preserves that order without re-sorting. */
function groupByDate(items: GrammarHistoryItem[]): { date: string; items: GrammarHistoryItem[] }[] {
  const groups: { date: string; items: GrammarHistoryItem[] }[] = [];
  for (const item of items) {
    const date = formatDate(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}

/** First CJK character of the sentence — used as the large faded kanji watermark on the card. */
function watermarkChar(text: string): string {
  const m = text.match(/[一-龯぀-ヿ]/);
  return m ? m[0] : "";
}

/** Highlights the first detected error's original fragment inside the full sentence, if it can be located. */
function HighlightedSentence({ item }: { item: GrammarHistoryItem }) {
  const fragment = item.first_error?.original_fragment;
  const idx = fragment ? item.original_text.indexOf(fragment) : -1;

  if (!fragment || idx === -1) {
    return (
      <p
        lang="ja"
        title={item.original_text}
        className="line-clamp-1 text-lg font-medium text-gray-900 dark:text-white/90"
      >
        {item.original_text}
      </p>
    );
  }

  return (
    <p
      lang="ja"
      title={item.original_text}
      className="line-clamp-1 text-lg font-medium text-gray-900 dark:text-white/90"
    >
      {item.original_text.slice(0, idx)}
      <span className="text-rose-500 underline decoration-dotted decoration-2 underline-offset-4">
        {fragment}
      </span>
      {item.original_text.slice(idx + fragment.length)}
    </p>
  );
}

function errorBadgeLabel(item: GrammarHistoryItem): string | null {
  const err = item.first_error;
  if (!err) return null;
  return err.corrected_fragment && err.corrected_fragment.length <= 6
    ? `${err.error_type} ${err.corrected_fragment}`
    : err.error_type;
}

/** One history record as a compact single-line row: time · sentence + AI fix · badges + action.
 * Long sentences are clamped to one line with an ellipsis — the full text only shows in the detail modal. */
function HistoryCard({ item, onOpen }: { item: GrammarHistoryItem; onOpen: () => void }) {
  const hasError = item.corrected_text !== item.original_text;
  const badgeLabel = errorBadgeLabel(item);
  const mark = watermarkChar(item.original_text);

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-l-4 bg-white px-5 py-4 shadow-sm transition-shadow duration-200 hover:shadow-[0_4px_18px_rgba(0,107,95,0.12)] dark:bg-gray-900 ${
        hasError
          ? "border-gray-200 border-l-rose-400 dark:border-gray-700"
          : "border-gray-200 border-l-emerald-500 dark:border-gray-700"
      }`}
    >
      {mark && (
        <span
          aria-hidden="true"
          lang="ja"
          className="pointer-events-none absolute -right-1 -bottom-3 select-none text-[64px] font-bold leading-none text-gray-900/[0.035] transition-opacity duration-200 group-hover:text-gray-900/[0.075] dark:text-white/5 dark:group-hover:text-white/10"
        >
          {mark}
        </span>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 sm:pr-36">
        {/* Time */}
        <div className="flex shrink-0 items-center sm:w-20 sm:border-r sm:border-gray-200 sm:pr-4 dark:sm:border-gray-700">
          <p className="flex items-center gap-1 text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
            <ClockIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
            {formatTime(item.created_at)}
          </p>
        </div>

        {/* Sentence + AI correction */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Câu đã nhập
          </p>
          <HighlightedSentence item={item} />

          {hasError ? (
            <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
              <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                Manabi sửa
              </span>
              <button
                lang="ja"
                title={item.corrected_text}
                onClick={onOpen}
                className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-teal-700 underline decoration-teal-700/30 underline-offset-4 hover:decoration-teal-700 dark:text-teal-300 dark:decoration-teal-300/40"
              >
                {item.corrected_text}
              </button>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 border-t border-gray-200 pt-2 text-sm font-medium text-emerald-600 dark:border-gray-700 dark:text-emerald-400">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <CheckIcon className="h-2.5 w-2.5" />
              </span>
              Không phát hiện lỗi ngữ pháp
            </p>
          )}

          {/* Badges + action — inline on mobile, moved to the card's corners at sm+ */}
          <div className="mt-2 flex shrink-0 flex-row items-center justify-between gap-3 sm:hidden">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                Ngữ pháp
              </span>
              {badgeLabel && (
                <span
                  lang="ja"
                  className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                >
                  {badgeLabel}
                </span>
              )}
            </div>
            <button
              onClick={onOpen}
              className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-gray-800 transition-colors hover:text-teal-700 dark:text-white/90 dark:hover:text-teal-300"
            >
              Xem chi tiết
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Corner badges: top-right */}
      <div className="absolute right-5 top-4 hidden flex-wrap justify-end gap-1.5 sm:flex">
        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
          Ngữ pháp
        </span>
        {badgeLabel && (
          <span
            lang="ja"
            className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
          >
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Corner action: bottom-right */}
      <button
        onClick={onOpen}
        className="absolute bottom-4 right-5 hidden items-center gap-1 whitespace-nowrap text-sm font-semibold text-gray-800 transition-colors hover:text-teal-700 sm:flex dark:text-white/90 dark:hover:text-teal-300"
      >
        Xem chi tiết
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** History tab: header stats, filter chips (Tất cả/Có lỗi/Đúng hoàn toàn), one compact card per row (10/page),
 * "Hiển thị X-Y trong số Z bản ghi" + right-aligned numbered pagination; clicking a card opens the detail modal. */
export default function HistoryTab({ active, onRecheck }: { active: boolean; onRecheck: (text: string) => void }) {
  const currentUser = getStoredUser();
  const {
    items,
    page,
    pageSize,
    total,
    totalPages,
    totalAll,
    totalChanged,
    status,
    changeStatus,
    loading,
    error,
    load,
    openDetail,
    closeDetail,
    removeItem,
    selected,
    detailLoading,
  } = useGrammarHistory(active && !!currentUser);

  if (!currentUser) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Vui lòng đăng nhập để xem lịch sử kiểm tra ngữ pháp.</p>
      </div>
    );
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-white/90">{totalAll} bản ghi</span>
          {" · "}
          {totalChanged} câu đã được sửa
        </p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => changeStatus(tab.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value
                  ? "bg-white text-brand-600 shadow-sm dark:bg-gray-900 dark:text-brand-400"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Đang tải lịch sử...</div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Chưa có lịch sử kiểm tra ngữ pháp nào.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="mt-4 space-y-5">
            {groupByDate(items).map((group) => (
              <div key={group.date}>
                <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1.5 dark:border-gray-700">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group.date}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{group.items.length} lần</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <HistoryCard key={item.id} item={item} onOpen={() => openDetail(item.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Hiển thị {rangeStart}-{rangeEnd} trong số {total} bản ghi
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={load} />
          </div>
        </>
      )}

      {(selected || detailLoading) && (
        <HistoryDetailModal
          detail={selected}
          loading={detailLoading}
          onClose={closeDetail}
          onDelete={removeItem}
          onRecheck={(text) => {
            closeDetail();
            onRecheck(text);
          }}
        />
      )}
    </div>
  );
}
