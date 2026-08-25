import type { SearchHistoryItem, User } from "../../../services/api";

interface HistorySidebarProps {
  currentUser: User | null;
  history: SearchHistoryItem[];
  loadingHistory: boolean;
  onItemClick: (item: SearchHistoryItem) => void;
  onDeleteItem: (e: React.MouseEvent, item: SearchHistoryItem) => void;
  onClearAll: () => void;
}

export default function HistorySidebar({
  currentUser,
  history,
  loadingHistory,
  onItemClick,
  onDeleteItem,
  onClearAll,
}: HistorySidebarProps) {
  return (
    <aside className="w-80 shrink-0">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-on-surface-variant dark:text-gray-400"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
              clipRule="evenodd"
            />
          </svg>
          <h2 className="text-sm font-semibold text-on-surface dark:text-gray-200">Lịch sử tra cứu</h2>
        </div>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs font-medium text-error hover:opacity-80 dark:hover:text-red-300 transition-colors"
            title="Xóa toàn bộ lịch sử"
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[calc(100vh-12rem)] space-y-3 overflow-y-auto pr-1">
        {!currentUser && (
          <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs text-outline dark:border-gray-700 dark:text-gray-500">
            Đăng nhập để lưu lịch sử tra cứu.
          </p>
        )}

        {currentUser && loadingHistory && (
          <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs italic text-outline dark:border-gray-700">
            Đang tải...
          </p>
        )}

        {currentUser && !loadingHistory && history.length === 0 && (
          <p className="rounded-2xl border border-outline-variant/60 px-4 py-6 text-center text-xs text-outline dark:border-gray-700 dark:text-gray-500">
            Chưa có từ nào được tra cứu.
          </p>
        )}

        {currentUser &&
          !loadingHistory &&
          history.length > 0 &&
          history.map((item) => (
            <div
              key={item.id}
              className="group relative cursor-pointer rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-5 py-4 shadow-theme-xs transition hover:border-outline-variant hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-900"
              onClick={() => onItemClick(item)}
            >
              <button
                onClick={(e) => onDeleteItem(e, item)}
                className="absolute right-3 top-3 shrink-0 text-outline-variant opacity-0 transition-all hover:text-error group-hover:opacity-100 dark:text-gray-600 dark:hover:text-red-400"
                title="Xóa mục này"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <p lang="ja" className="pr-5 text-lg font-bold text-on-surface dark:text-white truncate">
                {item.word}
              </p>
              {item.reading && item.reading !== item.word && (
                <p className="mt-0.5 text-sm text-outline dark:text-gray-500 truncate">{item.reading}</p>
              )}
              {item.meaning && (
                <p className="mt-1.5 text-xs text-on-surface-variant dark:text-gray-400 truncate">{item.meaning}</p>
              )}
            </div>
          ))}
      </div>
    </aside>
  );
}
