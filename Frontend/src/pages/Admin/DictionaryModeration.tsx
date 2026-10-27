import { useCallback, useEffect, useRef, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useUrlEnum, useUrlNumber, useUrlSearchInput } from "../../hooks/useUrlState";
import { useToast } from "../../context/ToastContext";
import StatCard from "../../components/admin-vocabulary/StatCard";
import Pagination from "../../components/admin-users/Pagination";
import ModerationRow from "../../components/admin-dictionary/ModerationRow";
import ImageDetailModal from "../../components/admin-dictionary/ImageDetailModal";
import CommentDetailModal from "../../components/admin-dictionary/CommentDetailModal";
import ConfirmActionModal from "../../components/admin-dictionary/ConfirmActionModal";
import ZoomableImage from "../../components/common/ZoomableImage";
import { AlertIcon, ChatIcon, ArrowDownIcon, CheckCircleIcon } from "../../icons";
import { LayersIcon, SearchIcon, FilterIcon } from "../../icons/custom";
import { ADMIN_PRIMARY_GRADIENT } from "../../utils/adminStyles";
import {
  AdminDictionaryCommentItem,
  AdminDictionaryImageItem,
  AdminDictionaryStats,
  DictionarySortOrder,
  ModerationStatus,
  bulkApproveComments,
  bulkApproveImages,
  deleteAdminComment,
  deleteAdminImage,
  fetchAdminComments,
  fetchAdminImages,
  fetchDictionaryStats,
  updateCommentStatus,
  updateImageStatus,
} from "../../services/adminDictionaryApi";

type Tab = "images" | "comments";

const SORT_OPTIONS: { value: DictionarySortOrder; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "score_asc", label: "Vote thấp nhất trước" },
  { value: "score_desc", label: "Vote cao nhất trước" },
];

export default function DictionaryModeration() {
  const { setPageHeader } = usePageHeader();
  const { showToast } = useToast();

  useEffect(() => {
    setPageHeader("Kiểm duyệt từ điển", "Quản lý ảnh minh hoạ và bình luận do cộng đồng đóng góp.");
  }, [setPageHeader]);

  // Tab, bộ lọc, sắp xếp và trang nằm trên URL -> tải lại / Back / gửi link giữ đúng chỗ.
  const [tab, setTabParam] = useUrlEnum<Tab>("tab", ["images", "comments"], "images");
  const [search, setSearchInput] = useUrlSearchInput("q");
  const [statusFilter, setStatusParam] = useUrlEnum<ModerationStatus | "">(
    "status",
    ["", "pending", "approved", "flagged"],
    ""
  );
  const [sort, setSortParam] = useUrlEnum<DictionarySortOrder>("sort", ["newest", "score_asc", "score_desc"], "newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [page, setPage] = useUrlNumber("page", 1);
  // Changing the tab/filters goes back to page 1 — in the setters rather than an
  // effect, which would also fire on load and wipe a ?page= restored from the URL.
  const setTab = (value: Tab) => {
    setTabParam(value);
    setPage(1);
  };
  const setSearch = (value: string) => {
    setSearchInput(value);
    setPage(1);
  };
  const setStatusFilter = (value: ModerationStatus | "") => {
    setStatusParam(value);
    setPage(1);
  };
  const setSort = (value: DictionarySortOrder) => {
    setSortParam(value);
    setPage(1);
  };

  const [stats, setStats] = useState<AdminDictionaryStats | null>(null);
  const [tabCounts, setTabCounts] = useState({ images: 0, comments: 0 });

  const [images, setImages] = useState<AdminDictionaryImageItem[]>([]);
  const [comments, setComments] = useState<AdminDictionaryCommentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [viewImage, setViewImage] = useState<AdminDictionaryImageItem | null>(null);
  const [viewComment, setViewComment] = useState<AdminDictionaryCommentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: Tab; id: number; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCount, setBulkCount] = useState(0);
  const [bulkApproving, setBulkApproving] = useState(false);

  const loadCounts = useCallback(async () => {
    const [statsRes, imagesRes, commentsRes] = await Promise.all([
      fetchDictionaryStats(),
      fetchAdminImages({ page: 1 }),
      fetchAdminComments({ page: 1 }),
    ]);
    setStats(statsRes);
    setTabCounts({ images: imagesRes.total, comments: commentsRes.total });
  }, []);

  // Changing a filter while on page > 1 fires two requests back to back (the
  // new filter with the old page, then page 1), and they can resolve in
  // either order. Only the most recently started one may write to state.
  const listRequestRef = useRef(0);

  const loadList = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    try {
      const params = { search: search.trim() || undefined, status: statusFilter, sort, page };
      const res = tab === "images" ? await fetchAdminImages(params) : await fetchAdminComments(params);
      if (requestId !== listRequestRef.current) return;

      // The page no longer exists (e.g. its last row was just deleted):
      // step back to the last page that does instead of showing an empty
      // table next to a non-zero total.
      if (res.items.length === 0 && res.total > 0 && page > 1) {
        setPage(Math.max(1, Math.ceil(res.total / res.page_size)));
        return;
      }

      if (tab === "images") setImages(res.items as AdminDictionaryImageItem[]);
      else setComments(res.items as AdminDictionaryCommentItem[]);
      setTotal(res.total);
      setPageSize(res.page_size);
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [tab, search, statusFilter, sort, page, setPage]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const refreshAll = async () => {
    await Promise.all([loadList(), loadCounts()]);
  };

  const handleSetStatus = async (type: Tab, id: number, status: ModerationStatus) => {
    try {
      if (type === "images") await updateImageStatus(id, status);
      else await updateCommentStatus(id, status);
      showToast("Đã cập nhật trạng thái", "success");
      await refreshAll();
    } catch {
      // reported globally
    }
  };

  const openDelete = (type: Tab, id: number, label: string) => setDeleteTarget({ type, id, label });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "images") await deleteAdminImage(deleteTarget.id);
      else await deleteAdminComment(deleteTarget.id);
      showToast("Đã xoá nội dung", "success");
      setDeleteTarget(null);
      await refreshAll();
    } catch {
      // reported globally
    } finally {
      setDeleting(false);
    }
  };

  const openBulkApprove = async () => {
    const res = tab === "images" ? await fetchAdminImages({ status: "pending", page: 1 }) : await fetchAdminComments({ status: "pending", page: 1 });
    setBulkCount(res.total);
    setBulkOpen(true);
  };

  const handleBulkApprove = async () => {
    setBulkApproving(true);
    try {
      const res = tab === "images" ? await bulkApproveImages() : await bulkApproveComments();
      showToast(`Đã duyệt ${res.approved_count} mục`, "success");
      setBulkOpen(false);
      await refreshAll();
    } catch {
      // reported globally
    } finally {
      setBulkApproving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageMeta title="Kiểm duyệt từ điển | Manabi AI" description="Quản lý ảnh minh hoạ và bình luận từ điển." />
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openBulkApprove}
            className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2.5 text-sm font-medium text-white shadow-[0_5px_12px_rgba(49,93,206,0.22)] ${ADMIN_PRIMARY_GRADIENT}`}
          >
            <CheckCircleIcon className="h-4 w-4" /> Duyệt hàng loạt
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tổng nội dung" value={stats?.total_content ?? 0} icon={<LayersIcon />} tone="neutral" />
          <StatCard label="Chờ xử lý" value={stats?.pending_count ?? 0} icon={<AlertIcon />} tone="pending" />
          <StatCard label="Nội dung hôm nay" value={stats?.today_count ?? 0} icon={<ChatIcon />} tone="neutral" />
          <StatCard label="Downvote cao" value={stats?.high_downvote_count ?? 0} icon={<ArrowDownIcon />} tone="success" />
        </div>

        <div className="rounded-2xl border border-admin-border bg-white shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
          <div className="flex gap-1 border-b border-admin-border px-4 pt-2">
            {(["images", "comments"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-admin-500 text-admin-600"
                    : "border-transparent text-admin-body hover:text-admin-ink"
                }`}
              >
                {t === "images" ? "Ảnh minh hoạ" : "Bình luận"}
                <span className="rounded-full bg-admin-fill px-2 py-0.5 text-xs font-medium text-admin-body">
                  {(t === "images" ? tabCounts.images : tabCounts.comments).toLocaleString("vi-VN")}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border p-4">
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-body" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo từ, nghĩa hoặc người đăng..."
                className="w-full rounded-[9px] border border-admin-border-input bg-admin-fill py-2.5 pl-10 pr-3.5 text-sm text-admin-ink outline-none placeholder:text-admin-meta focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ModerationStatus | "")}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="flagged">Cảnh báo</option>
              </select>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortMenu((v) => !v)}
                  className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm font-medium text-admin-body hover:bg-admin-fill"
                >
                  <FilterIcon className="h-4 w-4" /> Lọc nâng cao
                </button>
                {showSortMenu && (
                  <div
                    onMouseLeave={() => setShowSortMenu(false)}
                    className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-admin-border bg-white py-1 shadow-[0_4px_16px_rgba(35,67,110,0.12)]"
                  >
                    <p className="px-3.5 py-2 text-xs font-semibold uppercase tracking-[1.2px] text-admin-meta">
                      Sắp xếp theo
                    </p>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSort(opt.value);
                          setShowSortMenu(false);
                        }}
                        className={`flex w-full items-center px-3.5 py-2 text-left text-sm hover:bg-admin-fill ${
                          sort === opt.value ? "font-semibold text-admin-600" : "text-admin-body"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            {loading && <p className="px-4 py-8 text-center text-sm text-admin-body">Đang tải...</p>}
            {!loading && tab === "images" && images.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-admin-body">Không có ảnh nào phù hợp.</p>
            )}
            {!loading && tab === "comments" && comments.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-admin-body">Không có bình luận nào phù hợp.</p>
            )}

            {!loading &&
              tab === "images" &&
              images.map((img) => (
                <ModerationRow
                  key={img.id}
                  thumbnail={<ZoomableImage src={img.image_url} alt={img.word} className="h-full w-full object-cover" />}
                  wordJa={img.word}
                  subtitle={img.caption || "Ảnh minh hoạ được đề xuất cho từ vựng này."}
                  status={img.status}
                  uploaderName={img.uploader_username}
                  createdAt={img.created_at}
                  score={img.score}
                  onView={() => setViewImage(img)}
                  onDelete={() => openDelete("images", img.id, img.word)}
                  onSetStatus={(status) => handleSetStatus("images", img.id, status)}
                />
              ))}

            {!loading &&
              tab === "comments" &&
              comments.map((c) => (
                <ModerationRow
                  key={c.id}
                  thumbnail={
                    <span className="flex h-full w-full items-center justify-center bg-admin-50 text-admin-500">
                      <ChatIcon className="h-5 w-5" />
                    </span>
                  }
                  wordJa={c.word}
                  subtitle={c.content}
                  status={c.status}
                  uploaderName={c.username}
                  createdAt={c.created_at}
                  score={c.score}
                  onView={() => setViewComment(c)}
                  onDelete={() => openDelete("comments", c.id, c.word)}
                  onSetStatus={(status) => handleSetStatus("comments", c.id, status)}
                />
              ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-admin-meta">
            Hiển thị {total === 0 ? 0 : (page - 1) * pageSize + 1}
            {"–"}
            {(page - 1) * pageSize + (tab === "images" ? images.length : comments.length)} trong tổng số {total} nội
            dung
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {viewImage && <ImageDetailModal image={viewImage} onClose={() => setViewImage(null)} />}
      {viewComment && <CommentDetailModal comment={viewComment} onClose={() => setViewComment(null)} />}

      {deleteTarget && (
        <ConfirmActionModal
          title={`Xoá "${deleteTarget.label}"?`}
          description="Nội dung sẽ bị xoá vĩnh viễn khỏi từ điển và không thể khôi phục."
          confirmLabel="Xoá"
          confirmingLabel="Đang xoá..."
          tone="danger"
          saving={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {bulkOpen && (
        <ConfirmActionModal
          title="Duyệt hàng loạt"
          description={
            bulkCount > 0
              ? `Duyệt toàn bộ ${bulkCount} mục đang chờ xử lý ở tab "${tab === "images" ? "Ảnh minh hoạ" : "Bình luận"}"?`
              : "Không có mục nào đang chờ xử lý ở tab này."
          }
          confirmLabel={`Duyệt ${bulkCount} mục`}
          confirmingLabel="Đang duyệt..."
          saving={bulkApproving}
          onConfirm={handleBulkApprove}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </>
  );
}
