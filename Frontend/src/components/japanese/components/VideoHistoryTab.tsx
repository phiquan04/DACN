import { useCallback, useState } from "react";
import Pagination from "../../ui/pagination";
import { getErrorInfo } from "../../../utils/errors";
import { getStoredUser } from "../../../services/authApi";
import {
  deleteVideoHistoryItem,
  fetchVideoHistoryDetail,
  type VideoHistoryItem,
  type VideoHistoryStatus,
} from "../../../services/videoLearnApi";
import { useVideoHistory } from "../hooks/useVideoHistory";
import type { InitialSession } from "../JapaneseVideoTranscript";
import { PlayIcon } from "./icons";
import { ArrowRightIcon, CheckIcon, ClockIcon } from "../../../icons/custom";

const STATUS_TABS: { value: VideoHistoryStatus; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "watching", label: "Đang xem" },
  { value: "completed", label: "Đã xem xong" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN");
}

/** Groups records by calendar day for the "2/9/2026 · 2 video" section headers. Items already
 * arrive newest-first from the backend, so grouping preserves that order without re-sorting. */
function groupByDate(items: VideoHistoryItem[]): { date: string; items: VideoHistoryItem[] }[] {
  const groups: { date: string; items: VideoHistoryItem[] }[] = [];
  for (const item of items) {
    const date = formatDate(item.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) last.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}

/** One history record as a compact single-line row: time · thumbnail + title · status badge + action.
 * Green left border/badge for a video with a finished script (Đã xem xong), blue for one only opened so far (Đang xem). */
function HistoryRow({
  item,
  opening,
  deleting,
  onOpen,
  onDelete,
}: {
  item: VideoHistoryItem;
  opening: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const completed = item.has_script;

  return (
    <button
      onClick={onOpen}
      disabled={opening}
      className={`group relative flex items-center gap-4 rounded-xl border border-l-4 bg-white px-4 py-3 text-left shadow-sm transition-shadow duration-200 hover:shadow-[0_4px_18px_rgba(0,107,95,0.12)] disabled:opacity-60 dark:bg-gray-900 ${
        completed
          ? "border-gray-200 border-l-emerald-500 dark:border-gray-700"
          : "border-gray-200 border-l-sky-500 dark:border-gray-700"
      }`}
    >
      {/* Time */}
      <div className="flex shrink-0 items-center border-r border-gray-200 pr-4 sm:w-20 dark:border-gray-700">
        <p className="flex items-center gap-1 text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
          <ClockIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
          {formatTime(item.created_at)}
        </p>
      </div>

      {/* Thumbnail */}
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black">
        <img src={item.thumbnail} alt={item.video_title} className="h-full w-full object-cover" />
        {item.has_script && (
          <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white">
            <PlayIcon className="h-2.5 w-2.5" />
            {item.segment_count} đoạn
          </span>
        )}
      </div>

      {/* Title + channel + status */}
      <div className="min-w-0 flex-1 pr-24 sm:pr-36">
        <p
          lang="ja"
          title={item.video_title}
          className="line-clamp-1 text-base font-medium text-gray-900 dark:text-white/90"
        >
          {item.video_title}
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">{item.channel_title}</p>

        {completed ? (
          <p className="mt-2 flex items-center gap-1.5 border-t border-gray-200 pt-2 text-sm font-medium text-emerald-600 dark:border-gray-700 dark:text-emerald-400">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
              <CheckIcon className="h-2.5 w-2.5" />
            </span>
            Đã xem xong
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 border-t border-gray-200 pt-2 text-sm font-medium text-sky-600 dark:border-gray-700 dark:text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Đang xem
          </p>
        )}
      </div>

      {/* Corner badge + delete: top-right */}
      <div className="absolute right-3 top-3 hidden items-center gap-1.5 sm:flex">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            completed
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
          }`}
        >
          {completed ? "Đã xem xong" : "Đang xem"}
        </span>
        <span
          role="button"
          onClick={onDelete}
          className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
        >
          {deleting ? "…" : "Xoá"}
        </span>
      </div>

      {/* Corner action: bottom-right */}
      <span className="absolute bottom-3 right-3 hidden items-center gap-1 whitespace-nowrap text-sm font-semibold text-gray-800 transition-colors group-hover:text-teal-700 sm:flex dark:text-white/90 dark:group-hover:text-teal-300">
        {item.has_script ? "Xem lại script" : "Mở lại video"}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </span>

      {/* Mobile badge + delete row */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 sm:hidden">
        <span
          role="button"
          onClick={onDelete}
          className="rounded-lg px-2 py-1 text-xs font-medium text-error-600 transition hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
        >
          {deleting ? "…" : "Xoá"}
        </span>
      </div>
    </button>
  );
}

export default function VideoHistoryTab({
  active,
  onOpen,
}: {
  active: boolean;
  onOpen: (session: InitialSession) => void;
}) {
  const currentUser = getStoredUser();
  const {
    items,
    page,
    pageSize,
    total,
    totalPages,
    totalAll,
    totalCompleted,
    status,
    changeStatus,
    loading,
    error: loadError,
    load,
    removeItem,
  } = useVideoHistory(active && !!currentUser);

  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleOpen = useCallback(
    async (item: VideoHistoryItem) => {
      setOpeningId(item.id);
      try {
        const detail = await fetchVideoHistoryDetail(item.id);
        onOpen({
          video: {
            id: detail.video_id,
            title: detail.video_title,
            channelId: detail.channel_id,
            channelTitle: detail.channel_title,
            thumbnail: detail.thumbnail,
            duration: "",
            publishedAt: "",
          },
          segments: detail.segments,
        });
      } catch (err) {
        setError(getErrorInfo(err).message ?? "Không thể mở lại video này");
      } finally {
        setOpeningId(null);
      }
    },
    [onOpen]
  );

  const handleDelete = useCallback(
    async (item: VideoHistoryItem, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`Xoá lịch sử "${item.video_title}"?`)) return;
      setDeletingId(item.id);
      try {
        await deleteVideoHistoryItem(item.id);
        removeItem();
      } catch (err) {
        setError(getErrorInfo(err).message ?? "Không thể xoá mục này");
      } finally {
        setDeletingId(null);
      }
    },
    [removeItem]
  );

  if (!currentUser) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Vui lòng đăng nhập để lưu và xem lại lịch sử video.</p>
      </div>
    );
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const displayError = error || loadError;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-white/90">{totalAll} video đã xem</span>
          {" · "}
          {totalCompleted} video xem xong
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

      {loading && <div className="py-12 text-center text-gray-500 dark:text-gray-400">Đang tải lịch sử...</div>}

      {displayError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-400">
          {displayError}
        </div>
      )}

      {!loading && !displayError && items.length === 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-12 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Chưa có video nào trong lịch sử. Mở một video để bắt đầu.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="mt-4 space-y-5">
            {groupByDate(items).map((group) => (
              <div key={group.date}>
                <div className="mb-2 flex items-center justify-between border-b border-gray-200 pb-1.5 dark:border-gray-700">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{group.date}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{group.items.length} video</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {group.items.map((item) => (
                    <HistoryRow
                      key={item.id}
                      item={item}
                      opening={openingId === item.id}
                      deleting={deletingId === item.id}
                      onOpen={() => handleOpen(item)}
                      onDelete={(e) => handleDelete(item, e)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Hiển thị {rangeStart}-{rangeEnd} trong số {total} video
            </p>
            <Pagination page={page} totalPages={totalPages} onChange={load} />
          </div>
        </>
      )}
    </div>
  );
}
