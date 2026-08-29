import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  VocabularyItemCreate,
  VocabularyItemPatch,
  VocabularySetReview,
  VocabularySetSummary,
  createVocabularyItem,
  deleteVocabularyItem,
  deleteVocabularySet,
  fetchVocabularySetReview,
  fetchVocabularySets,
  markAllVocabularyItemsReviewed,
  publishVocabularySet,
  updateVocabularyItem,
} from "../../services/vocabularyApi";
import NewVocabularyItemForm from "./NewVocabularyItemForm";
import VocabularyItemCard from "./VocabularyItemCard";
import { TrashIcon } from "../admin-jlpt/icons";
import { ChevronLeftIcon } from "../../icons";

const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  failed: "Lỗi",
  published: "Đã publish",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    processing: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    draft: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${styles[status] ?? styles.draft}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function ReviewVocabularySets({ focusSetId }: { focusSetId?: number | null }) {
  const { showToast } = useToast();
  const [sets, setSets] = useState<VocabularySetSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(focusSetId ?? null);
  const [detail, setDetail] = useState<VocabularySetReview | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadList = async () => {
    setLoadingList(true);
    try {
      setSets(await fetchVocabularySets());
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  useEffect(() => {
    if (focusSetId) setSelectedId(focusSetId);
  }, [focusSetId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    fetchVocabularySetReview(selectedId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const refreshDetail = async () => {
    if (!selectedId) return;
    setDetail(await fetchVocabularySetReview(selectedId));
  };

  const handleSaveItem = async (itemId: number, patch: VocabularyItemPatch) => {
    if (!selectedId) return;
    try {
      await updateVocabularyItem(selectedId, itemId, patch);
      await refreshDetail();
      showToast("Đã lưu từ vựng", "success");
    } catch {
      // reported globally
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedId) return;
    try {
      await deleteVocabularyItem(selectedId, itemId);
      await refreshDetail();
      showToast("Đã xóa từ vựng", "success");
    } catch {
      // reported globally
    }
  };

  const handleCreateItem = async (payload: VocabularyItemCreate) => {
    if (!selectedId) return;
    try {
      await createVocabularyItem(selectedId, payload);
      await refreshDetail();
      showToast("Đã thêm từ mới", "success");
    } catch {
      // reported globally
    }
  };

  const handleMarkAllReviewed = async () => {
    if (!selectedId) return;
    setMarkingAll(true);
    try {
      await markAllVocabularyItemsReviewed(selectedId);
      showToast("Đã duyệt toàn bộ từ", "success");
      await refreshDetail();
      await loadList();
    } catch {
      // reported globally
    } finally {
      setMarkingAll(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedId) return;
    setPublishing(true);
    try {
      await publishVocabularySet(selectedId);
      showToast("Đã publish bộ từ vựng — user có thể học ngay", "success");
      await refreshDetail();
      await loadList();
    } catch {
      // reported globally (409 detail liệt kê từ còn thiếu)
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (setId: number) => {
    if (!window.confirm("Xóa bộ từ vựng này? Hành động không thể hoàn tác.")) return;
    try {
      await deleteVocabularySet(setId);
      showToast("Đã xóa bộ từ vựng", "success");
      if (selectedId === setId) setSelectedId(null);
      await loadList();
    } catch {
      // reported globally
    }
  };

  if (selectedId && detail) {
    const sortedItems = [...detail.items].sort((a, b) => a.order_no - b.order_no);

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{detail.set_name}</h3>
              <StatusBadge status={detail.status} />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {detail.level}
              {detail.curriculum_name && ` · ${detail.curriculum_name}`}
              {detail.category_name && ` · ${detail.category_name}`} · {detail.reviewed_count}/{detail.item_count} từ
              đã duyệt
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllReviewed}
              disabled={markingAll || detail.status === "published" || detail.reviewed_count >= detail.item_count}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-teal-500 hover:text-teal-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:text-teal-400"
            >
              {markingAll ? "Đang duyệt..." : "Lưu toàn bộ từ"}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || detail.status === "published"}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {detail.status === "published"
                ? "Đã publish"
                : publishing
                ? "Đang publish..."
                : "Lưu chính thức (Publish)"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-2.5">
            {sortedItems.map((item) => (
              <VocabularyItemCard
                key={item.id}
                item={item}
                onSave={(patch) => handleSaveItem(item.id, patch)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
            <NewVocabularyItemForm onCreate={handleCreateItem} />
          </div>
        </div>
      </div>
    );
  }

  if (selectedId && loadingDetail) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải bộ từ vựng...</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {loadingList && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
      {!loadingList && sets.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bộ từ vựng nào được import.</p>
      )}
      {sets.map((set) => (
        <div
          key={set.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal-500 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => (set.status !== "processing" ? setSelectedId(set.id) : undefined)}
          >
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{set.set_name}</span>
              <StatusBadge status={set.status} />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {set.level}
              {set.curriculum_name && ` · ${set.curriculum_name}`}
              {set.category_name && ` · ${set.category_name}`} · {set.reviewed_count}/{set.item_count} từ đã duyệt
            </p>
            {set.status === "failed" && set.error_message && (
              <p className="mt-1 truncate text-xs text-rose-600 dark:text-rose-400" title={set.error_message}>
                {set.error_message}
              </p>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(set.id)}
            className="shrink-0 text-gray-400 hover:text-rose-500"
            title="Xóa bộ từ vựng"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
