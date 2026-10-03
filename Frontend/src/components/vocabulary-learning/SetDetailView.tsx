import { useEffect, useRef, useState } from "react";
import { AudioIcon, ChevronLeftIcon, FolderIcon } from "../../icons";
import {
  BatchSource,
  VocabularySetLearningDetail,
  copyItemToMine,
  fetchSetForLearning,
  speakJapanese,
  toggleBookmark,
} from "../../services/vocabularyLearningApi";
import AddToMineModal from "./AddToMineModal";
import BookmarkToggle from "./BookmarkToggle";
import Pagination from "../ui/pagination";
import ProgressBar from "./ProgressBar";
import { SourceOption, StudyModeList, StudySessionSettings, useStudyConfig } from "./StudyConfigPanel";
import { StudyMode } from "./types";

const STATUS_LABEL: Record<string, string> = { new: "Mới", reviewing: "Cần ôn", learned: "Đã thuộc" };
const STATUS_CLASS: Record<string, string> = {
  new: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  reviewing: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
  learned: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};

const PAGE_SIZE = 10;

export default function SetDetailView({
  setId,
  onBack,
  onStart,
  starting = false,
}: {
  setId: number;
  onBack: () => void;
  onStart: (mode: StudyMode, count: number, source: BatchSource) => void;
  starting?: boolean;
}) {
  const [detail, setDetail] = useState<VocabularySetLearningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<BatchSource>("sequential");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "learned" | "reviewing" | "new">("all");
  const [addToMineItemId, setAddToMineItemId] = useState<number | null>(null);
  const { mode, setMode, count, customCount, selectPreset, changeCustomCount } = useStudyConfig();
  const listTopRef = useRef<HTMLDivElement>(null);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSetForLearning(setId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [setId]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const handleToggleBookmark = async (itemId: number) => {
    try {
      const res = await toggleBookmark(itemId);
      setDetail((prev) =>
        prev
          ? { ...prev, items: prev.items.map((it) => (it.id === itemId ? { ...it, is_bookmarked: res.is_bookmarked } : it)) }
          : prev
      );
    } catch {
      // reported globally by the http client
    }
  };

  if (loading || !detail) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>;
  }

  const sourceOptions: SourceOption[] = [
    {
      value: "sequential",
      label: "Từ tiếp theo ",
      hint: `còn ${detail.new_count} từ chưa học`,
      disabled: detail.new_count === 0,
    },
    {
      value: "review",
      label: "Cần ôn lại",
      hint: `${detail.reviewing_count} từ`,
      disabled: detail.reviewing_count === 0,
    },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = detail.items.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (!normalizedSearch) return true;
    return (
      item.word.toLowerCase().includes(normalizedSearch) ||
      (item.reading?.toLowerCase().includes(normalizedSearch) ?? false) ||
      (item.han_viet?.toLowerCase().includes(normalizedSearch) ?? false) ||
      item.meaning_vi.toLowerCase().includes(normalizedSearch)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pagedItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Quay lại thư viện
      </button>

      {/* ===== Header: set info + overall progress ===== */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            <FolderIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{detail.set_name}</h2>
              <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                {detail.level}
              </span>
            </div>
            {detail.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{detail.learned_count} đã thuộc</span>
          </span>
          <span>{detail.item_count} từ</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar learned={detail.learned_count} reviewing={detail.reviewing_count} total={detail.item_count} />
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Đã thuộc
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Cần ôn
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" /> Mới
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* ===== LEFT: vocabulary list — flows with the document, no internal scroll cap ===== */}
        <div
          ref={listTopRef}
          className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:col-span-2"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Danh sách từ vựng</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Tổng số: {detail.item_count} từ</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo từ, cách đọc, âm Hán Việt, nghĩa..."
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 outline-none focus:border-brand-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { value: "all" as const, label: "Tất cả" },
                  { value: "learned" as const, label: "Đã thuộc" },
                  { value: "reviewing" as const, label: "Cần ôn" },
                  { value: "new" as const, label: "Mới" },
                ]
              ).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? "bg-brand-500 text-white"
                      : "border border-gray-300 text-gray-600 hover:border-teal-400 dark:border-gray-600 dark:text-gray-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {filteredItems.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Không tìm thấy từ phù hợp.
              </p>
            )}
            {pagedItems.map((item) => (
              <div
                key={item.id}
                className="relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900"
              >
                <BookmarkToggle active={item.is_bookmarked} onToggle={() => handleToggleBookmark(item.id)} />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAddToMineItemId(item.id);
                  }}
                  aria-label="Thêm từ này vào bộ của tôi"
                  title="Thêm vào bộ của tôi"
                  className="absolute right-10 top-3 z-10 text-gray-300 hover:text-teal-600 dark:text-gray-600 dark:hover:text-teal-400"
                >
                  <FolderIcon className="h-5 w-5" />
                </button>

                <div className="flex flex-wrap items-center gap-2 pr-20">
                  <span lang="ja" className="text-lg font-bold text-gray-800 dark:text-white/90">
                    {item.word}
                  </span>
                  {item.reading && (
                    <span lang="ja" className="text-sm text-gray-400 dark:text-gray-500">
                      {item.reading}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => speakJapanese(item.word).catch(() => {})}
                    aria-label="Phát âm"
                    className="text-gray-400 hover:text-teal-600 dark:text-gray-500 dark:hover:text-teal-400"
                  >
                    <AudioIcon className="h-4 w-4" />
                  </button>
                </div>

                {item.han_viet && (
                  <span className="text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                    {item.han_viet}
                  </span>
                )}

                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{item.meaning_vi}</p>

                {item.example_sentence_ja && (
                  <div className="rounded-lg bg-gray-50 p-2.5 dark:bg-gray-800">
                    <p lang="ja" className="text-xs text-gray-600 dark:text-gray-300">
                      {item.example_sentence_ja}
                    </p>
                    {item.example_sentence_vi && (
                      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{item.example_sentence_vi}</p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[item.status]}`}
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                  <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {detail.level}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4">
            <Pagination page={page} totalPages={totalPages} onChange={handlePageChange} />
          </div>
        </div>

        {/* ===== RIGHT: study mode + session settings, as two separate cards ===== */}
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Chế độ học</h3>
            <StudyModeList mode={mode} onSelect={setMode} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Cài đặt phiên học</h3>
            <StudySessionSettings
              sourceOptions={sourceOptions}
              source={source}
              onSourceChange={(v) => setSource(v as BatchSource)}
              count={count}
              customCount={customCount}
              onSelectPreset={selectPreset}
              onCustomCountChange={changeCustomCount}
            />
            <button
              type="button"
              disabled={starting || count < 1}
              onClick={() => onStart(mode, count, source)}
              className="mt-5 w-full rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:from-brand-300 disabled:to-brand-300"
            >
              {starting ? "Đang chuẩn bị..." : "Bắt đầu học"}
            </button>
          </div>
        </div>
      </div>

      {addToMineItemId !== null && (
        <AddToMineModal
          onPick={(setId) => copyItemToMine(addToMineItemId, setId)}
          onClose={() => setAddToMineItemId(null)}
        />
      )}
    </div>
  );
}
