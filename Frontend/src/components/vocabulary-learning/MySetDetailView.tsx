import { useEffect, useRef, useState } from "react";
import { AudioIcon, ChevronLeftIcon, FolderIcon, PlusIcon, TrashBinIcon } from "../../icons";
import {
  BatchSource, MySetDetail, createMyItem, deleteMyItem, deleteMySet, fetchMySet, speakJapanese,
} from "../../services/vocabularyLearningApi";
import Pagination from "../ui/pagination";
import { useUrlNumber, useUrlSearchInput } from "../../hooks/useUrlState";
import { CreateWordModal } from "./MyVocabularyShared";
import ProgressBar from "./ProgressBar";
import { SourceOption, StudyModeList, StudySessionSettings, useStudyConfig } from "./StudyConfigPanel";
import { StudyMode } from "./types";

const PAGE_SIZE = 10;

export default function MySetDetailView({
  setId,
  onBack,
  onDeleted,
  onStart,
  starting = false,
}: {
  setId: number;
  onBack: () => void;
  onDeleted: () => void;
  onStart: (mode: StudyMode, count: number, source: BatchSource) => void;
  starting?: boolean;
}) {
  const [detail, setDetail] = useState<MySetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateWord, setShowCreateWord] = useState(false);
  // Trang / ô tìm nằm trên URL -> tải lại hoặc Back vẫn giữ đúng chỗ.
  const [page, setPage] = useUrlNumber("page", 1);
  const [search, setSearchInput] = useUrlSearchInput("search");
  // Về trang 1 ngay trong handler (effect sẽ xoá mất ?page= lúc mở trang).
  const setSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };
  const [source, setSource] = useState<BatchSource>("sequential");
  const { mode, setMode, count, customCount, selectPreset, changeCustomCount } = useStudyConfig();
  const listTopRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    fetchMySet(setId)
      .then(setDetail)
      // e.g. the bài was deleted in the meantime (404) — the error itself is
      // already toasted by the http client; here it just must not leave the
      // view stuck on "Đang tải...".
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [setId]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>;
  }
  if (!detail) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Quay lại bộ từ vựng
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400">Không tìm thấy danh mục này.</p>
      </div>
    );
  }

  const sourceOptions: SourceOption[] = [
    {
      value: "sequential",
      label: "Từ tiếp theo",
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
        Quay lại bộ từ vựng
      </button>

      {/* ===== Header: set info + overall progress ===== */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
              <FolderIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{detail.set_name}</h2>
              {detail.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail.description}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (
                !window.confirm(
                  `Xóa danh mục "${detail.set_name}"? Toàn bộ từ vựng và tiến độ học bên trong sẽ bị xóa vĩnh viễn.`
                )
              )
                return;
              await deleteMySet(detail.id);
              onDeleted();
            }}
            aria-label="Xóa danh mục này"
            title="Xóa danh mục này"
            className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          >
            <TrashBinIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar learned={detail.learned_count} reviewing={detail.reviewing_count} total={detail.item_count} />
          </div>
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{detail.item_count} từ</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {detail.learned_count} thuộc
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> {detail.reviewing_count} cần ôn
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" /> {detail.new_count} mới
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* ===== LEFT: vocabulary list ===== */}
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
            <button
              type="button"
              onClick={() => setShowCreateWord(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Thêm từ
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            {filteredItems.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                {detail.items.length === 0 ? "Danh mục này chưa có từ nào." : "Không tìm thấy từ phù hợp."}
              </p>
            )}
            {pagedItems.map((item) => (
              <div
                key={item.id}
                className="relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Xóa từ "${item.word}" khỏi danh mục này?`)) return;
                    await deleteMyItem(item.id);
                    load();
                  }}
                  aria-label="Xóa từ này"
                  className="absolute right-3 top-3 text-gray-300 hover:text-rose-500 dark:text-gray-600"
                >
                  <TrashBinIcon className="h-4 w-4" />
                </button>

                <div className="flex flex-wrap items-center gap-2 pr-8">
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

                {item.word_type && (
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {item.word_type}
                    </span>
                  </div>
                )}
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

      {showCreateWord && (
        <CreateWordModal
          onCancel={() => setShowCreateWord(false)}
          onSubmit={async (payload) => {
            await createMyItem(detail.id, payload);
            setShowCreateWord(false);
            load();
          }}
        />
      )}
    </div>
  );
}
