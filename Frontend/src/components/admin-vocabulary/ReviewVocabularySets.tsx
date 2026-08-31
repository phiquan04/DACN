import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../context/ToastContext";
import { ApiError } from "../../services/httpClient";
import {
  Curriculum,
  VocabCategory,
  VocabularyItemCreate,
  VocabularyItemPatch,
  VocabularySetPatch,
  VocabularySetReview,
  VocabularySetSummary,
  createVocabularyItem,
  deleteVocabularyItem,
  deleteVocabularySet,
  fetchCategories,
  fetchCurriculums,
  fetchVocabularySetReview,
  fetchVocabularySets,
  markAllVocabularyItemsReviewed,
  publishVocabularySet,
  updateVocabularyItem,
  updateVocabularySet,
} from "../../services/vocabularyApi";
import NewVocabularyItemForm from "./NewVocabularyItemForm";
import VocabularyItemCard from "./VocabularyItemCard";
import VocabularySetRow, { StatusBadge } from "./VocabularySetRow";
import VocabularySetFilters, { EMPTY_FILTERS, VocabularySetFilterValues } from "./VocabularySetFilters";
import StatCard from "./StatCard";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { BoxCubeIcon, ChevronLeftIcon } from "../../icons";

const ITEMS_PAGE_SIZE = 30;

export default function ReviewVocabularySets({ focusSetId }: { focusSetId?: number | null }) {
  const { showToast } = useToast();
  const [sets, setSets] = useState<VocabularySetSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [categories, setCategories] = useState<VocabCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<VocabularySetFilterValues>(EMPTY_FILTERS);
  const [activeTab, setActiveTab] = useState<"active" | "locked">("active");
  const [selectedId, setSelectedId] = useState<number | null>(focusSetId ?? null);
  const [detail, setDetail] = useState<VocabularySetReview | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);

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
    fetchCurriculums().then(setCurriculums).catch(() => {});
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (focusSetId) setSelectedId(focusSetId);
  }, [focusSetId]);

  useEffect(() => {
    setItemsPage(1);
  }, [selectedId]);

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
    } catch (err) {
      // 409 = đã có học viên học, backend tự động khóa set thay vì xóa — đưa
      // admin sang tab "Đã khóa" để họ thấy ngay kết quả (thông báo lỗi đã
      // được errorReporter toàn cục hiển thị rồi, message giải thích lý do).
      if (err instanceof ApiError && err.status === 409) {
        if (selectedId === setId) setSelectedId(null);
        await loadList();
        setActiveTab("locked");
      }
    }
  };

  const handleUpdateSet = async (setId: number, patch: VocabularySetPatch) => {
    try {
      await updateVocabularySet(setId, patch);
      showToast("Đã lưu bộ từ vựng", "success");
      await loadList();
    } catch {
      // reported globally — mirrors handleSaveItem: the row still exits edit
      // mode even on failure, same tradeoff already accepted for word cards.
    }
  };

  const handleToggleLock = async (set: VocabularySetSummary) => {
    try {
      await updateVocabularySet(set.id, { is_locked: !set.is_locked });
      showToast(set.is_locked ? "Đã mở khóa — học viên xem lại được" : "Đã khóa — ẩn khỏi học viên", "success");
      await loadList();
    } catch {
      // reported globally
    }
  };

  const filteredSets = useMemo(() => {
    return sets.filter((s) => {
      if (activeTab === "locked" ? !s.is_locked : s.is_locked) return false;
      if (search.trim() && !s.set_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (filters.curriculumId !== "" && s.curriculum_id !== filters.curriculumId) return false;
      if (filters.categoryId !== "" && s.category_id !== filters.categoryId) return false;
      if (filters.status && s.status !== filters.status) return false;
      return true;
    });
  }, [sets, search, filters, activeTab]);

  const lockedCount = sets.filter((s) => s.is_locked).length;

  if (selectedId && detail) {
    const sortedItems = [...detail.items].sort((a, b) => a.order_no - b.order_no);
    const totalItemPages = Math.max(1, Math.ceil(sortedItems.length / ITEMS_PAGE_SIZE));
    const currentItemsPage = Math.min(itemsPage, totalItemPages);
    const pageItems = sortedItems.slice(
      (currentItemsPage - 1) * ITEMS_PAGE_SIZE,
      currentItemsPage * ITEMS_PAGE_SIZE
    );

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
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((item) => (
              <VocabularyItemCard
                key={item.id}
                item={item}
                onSave={(patch) => handleSaveItem(item.id, patch)}
                onDelete={() => handleDeleteItem(item.id)}
              />
            ))}
            <div className="col-span-full">
              <NewVocabularyItemForm onCreate={handleCreateItem} />
            </div>
          </div>

          {sortedItems.length > ITEMS_PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
                disabled={currentItemsPage <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Trước
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Trang {currentItemsPage}/{totalItemPages} · {sortedItems.length} từ
              </span>
              <button
                type="button"
                onClick={() => setItemsPage((p) => Math.min(totalItemPages, p + 1))}
                disabled={currentItemsPage >= totalItemPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedId && loadingDetail) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải bộ từ vựng...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tổng số bộ từ vựng" value={sets.length} icon={<BoxCubeIcon />} />
        <StatCard label="Đang mở" value={sets.length - lockedCount} icon={<UnlockIcon />} />
        <StatCard label="Đang khóa" value={lockedCount} icon={<LockIcon />} />
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
            activeTab === "active"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          Danh sách
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("locked")}
          className={`flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium transition ${
            activeTab === "locked"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          }`}
        >
          <LockIcon className="h-3.5 w-3.5" /> Đã khóa
          {lockedCount > 0 && (
            <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
              {lockedCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === "locked" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Các bộ từ vựng ở đây đang bị ẩn khỏi học viên — hoặc do admin khóa tay, hoặc do hệ thống tự khóa vì có
          học viên đã học nên không thể xóa. Mở khóa tại đây để hiện lại trong mục "Danh sách".
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên bộ từ vựng..."
          className="min-w-[240px] flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
        <VocabularySetFilters curriculums={curriculums} categories={categories} value={filters} onApply={setFilters} />
      </div>

      <div className="flex flex-col gap-2.5">
        {loadingList && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>}
        {!loadingList && sets.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bộ từ vựng nào được import.</p>
        )}
        {!loadingList && sets.length > 0 && filteredSets.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeTab === "locked" ? "Không có bộ từ vựng nào đang bị khóa." : "Không tìm thấy bộ từ vựng phù hợp."}
          </p>
        )}
        {filteredSets.map((set) => (
          <VocabularySetRow
            key={set.id}
            set={set}
            curriculums={curriculums}
            categories={categories}
            onOpen={() => setSelectedId(set.id)}
            onUpdate={(patch) => handleUpdateSet(set.id, patch)}
            onToggleLock={() => handleToggleLock(set)}
            onDelete={() => handleDelete(set.id)}
          />
        ))}
      </div>
    </div>
  );
}
