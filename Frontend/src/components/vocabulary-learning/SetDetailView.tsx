import { useEffect, useState } from "react";
import { AudioIcon, ChevronLeftIcon } from "../../icons";
import {
  BatchSource,
  VocabularySetLearningDetail,
  fetchSetForLearning,
  speakJapanese,
  toggleBookmark,
} from "../../services/vocabularyLearningApi";
import BookmarkToggle from "./BookmarkToggle";
import Pagination from "./Pagination";
import StudyConfigPanel, { SourceOption } from "./StudyConfigPanel";
import { StudyMode } from "./types";

const STATUS_LABEL: Record<string, string> = { new: "Mới", reviewing: "Cần ôn", learned: "Đã thuộc" };
const STATUS_CLASS: Record<string, string> = {
  new: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  reviewing: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300",
  learned: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
};

const PAGE_SIZE = 20;

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

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchSetForLearning(setId)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [setId]);

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
      label: "Từ tiếp theo (theo thứ tự)",
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

  const totalPages = Math.max(1, Math.ceil(detail.items.length / PAGE_SIZE));
  const pagedItems = detail.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            {detail.level}
          </span>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white/90">{detail.set_name}</h2>
        </div>
        {detail.description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{detail.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Danh sách từ vựng</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Tổng số: {detail.item_count} từ</span>
          </div>

          <div className="max-h-[70vh] space-y-2.5 overflow-y-auto pr-1">
            {pagedItems.map((item) => (
              <div
                key={item.id}
                className="relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 dark:border-gray-700 dark:bg-gray-900"
              >
                <BookmarkToggle active={item.is_bookmarked} onToggle={() => handleToggleBookmark(item.id)} />

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
                  <span className="text-xs font-medium text-teal-600 dark:text-teal-400">{item.han_viet}</span>
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

                <span
                  className={`self-start rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[item.status]}`}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <StudyConfigPanel
            sourceOptions={sourceOptions}
            source={source}
            onSourceChange={(v) => setSource(v as BatchSource)}
            onStart={(mode, count) => onStart(mode, count, source)}
            starting={starting}
          />
        </div>
      </div>
    </div>
  );
}
