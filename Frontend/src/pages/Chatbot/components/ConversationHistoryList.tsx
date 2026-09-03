import Pagination from "../../../components/ui/pagination";
import type { ConversationHistoryItem } from "../../../services/chatApi";
import { parseApiDate } from "../../../utils/datetime";
import { ChatBubbleIcon, ClockIcon } from "./icons";

function formatDateTime(iso: string) {
  const d = parseApiDate(iso);
  if (!d) return "";
  return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function HistoryCard({
  item,
  isActive,
  onResume,
  resuming,
}: {
  item: ConversationHistoryItem;
  isActive: boolean;
  onResume: () => void;
  resuming: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onResume}
      disabled={resuming}
      className={`flex items-center gap-3 rounded-lg border-l-4 p-3.5 text-left transition-colors disabled:opacity-60 ${
        isActive
          ? "border-l-brand-500 bg-brand-100 dark:border-l-brand-400 dark:bg-brand-500/15"
          : "border-l-brand-200 bg-brand-50/70 hover:border-l-teal-500 hover:bg-teal-50 dark:border-l-brand-500/40 dark:bg-brand-500/5 dark:hover:border-l-teal-400 dark:hover:bg-teal-500/10"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${
          isActive
            ? "bg-brand-600 text-white"
            : "bg-white text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        }`}
      >
        {item.scenario_icon || <ChatBubbleIcon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          lang="ja"
          title={item.title ?? undefined}
          className={`block truncate text-sm font-semibold ${
            isActive ? "text-brand-700 dark:text-brand-300" : "text-gray-800 dark:text-white/90"
          }`}
        >
          {item.title || "Hội thoại tự do"}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <ClockIcon className="h-3 w-3" />
          {formatDateTime(item.updated_at)}
          <span>&middot;</span>
          {item.message_count} tin nhắn
        </span>
      </span>
    </button>
  );
}

interface Props {
  items: ConversationHistoryItem[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  load: (page: number) => void;
  resumingId: number | null;
  activeConversationId: number | null;
  onResume: (id: number) => void;
}

export default function ConversationHistoryList({
  items,
  page,
  totalPages,
  loading,
  error,
  load,
  resumingId,
  activeConversationId,
  onResume,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pb-3 pt-4">
        {loading && <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">Đang tải...</p>}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-700 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">Chưa có hội thoại nào được lưu.</p>
        )}

        {!loading &&
          items.map((item) => (
            <HistoryCard
              key={item.id}
              item={item}
              isActive={activeConversationId === item.id}
              onResume={() => onResume(item.id)}
              resuming={resumingId === item.id}
            />
          ))}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <Pagination page={page} totalPages={totalPages} onChange={load} />
        </div>
      )}
    </div>
  );
}
