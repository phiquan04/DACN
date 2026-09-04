import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useToast } from "../../context/ToastContext";
import { getStoredUser } from "../../services/authApi";
import {
  AdminUserDetail,
  AdminUserSummary,
  CreateUserPayload,
  JlptLevelFilter,
  UpdateUserPayload,
  UserRoleFilter,
  UserStatusFilter,
  createUser,
  fetchUserDetail,
  fetchUsers,
  lockUser,
  resetUserPassword,
  unlockUser,
  updateUser,
} from "../../services/adminUserApi";
import UserTableRow from "../../components/admin-users/UserTableRow";
import UserDetailView from "../../components/admin-users/UserDetailView";
import LockUserModal from "../../components/admin-users/LockUserModal";
import CreateUserModal from "../../components/admin-users/CreateUserModal";
import EditUserModal from "../../components/admin-users/EditUserModal";
import ResetPasswordModal from "../../components/admin-users/ResetPasswordModal";
import Pagination from "../../components/admin-users/Pagination";
import StatCard from "../../components/admin-vocabulary/StatCard";
import { CheckCircleIcon, DownloadIcon, GroupIcon, LockIcon as OutlineLockIcon, PlusIcon, UserCircleIcon } from "../../icons";
import { SearchIcon } from "../../icons/custom";
import { ADMIN_PRIMARY_GRADIENT } from "../../utils/adminStyles";
import BulkLockModal from "../../components/admin-users/BulkLockModal";
import AdminCheckbox from "../../components/admin-users/AdminCheckbox";
import { LockIcon } from "../../components/admin-jlpt/icons";

interface Stats {
  total: number;
  active: number;
  locked: number;
  admins: number;
}

function exportUsersCsv(items: AdminUserSummary[]) {
  const header = ["ID", "Tên", "Username", "Email", "Vai trò", "Trình độ", "XP", "Streak", "Trạng thái", "Đăng nhập gần nhất"];
  const rows = items.map((u) => [
    u.id,
    [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username,
    u.username,
    u.email,
    u.role === "admin" ? "Quản trị viên" : "Người dùng",
    u.current_jlpt_level ?? "",
    u.vocab_xp,
    u.streak_days,
    u.is_active ? "Hoạt động" : "Đã khóa",
    u.last_login_at ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nguoi-dung-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function UserManagement() {
  const { setPageHeader } = usePageHeader();
  const { showToast } = useToast();

  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRoleFilter>("");
  const [status, setStatus] = useState<UserStatusFilter>("");
  const [jlptLevel, setJlptLevel] = useState<JlptLevelFilter>("");
  const [stats, setStats] = useState<Stats | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [lockTarget, setLockTarget] = useState<{ id: number; username: string } | null>(null);
  const [editTarget, setEditTarget] = useState<AdminUserDetail | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ id: number; username: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkLockModal, setShowBulkLockModal] = useState(false);
  const [bulkLocking, setBulkLocking] = useState(false);

  const currentUserId = getStoredUser()?.id;

  useEffect(() => {
    setPageHeader("Quản lý người dùng", "Theo dõi, quản lý và hỗ trợ cộng đồng học viên Manabi AI.");
  }, [setPageHeader]);

  const loadStats = useCallback(async () => {
    const [all, active, locked, admins] = await Promise.all([
      fetchUsers({ page: 1 }),
      fetchUsers({ status: "active", page: 1 }),
      fetchUsers({ status: "locked", page: 1 }),
      fetchUsers({ role: "admin", page: 1 }),
    ]);
    setStats({ total: all.total, active: active.total, locked: locked.total, admins: admins.total });
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetchUsers({ search: search.trim() || undefined, role, status, jlptLevel, page });
      setItems(res.items);
      setTotal(res.total);
      setPageSize(res.page_size);
    } finally {
      setLoadingList(false);
    }
  }, [search, role, status, jlptLevel, page]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Filter/search changes reset back to page 1 instead of staying on a page
  // that may no longer exist for the new result set.
  useEffect(() => {
    setPage(1);
  }, [search, role, status, jlptLevel]);

  // Selection is scoped to what's currently loaded — clear it whenever the
  // result set underneath it changes so stale ids can't linger.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, role, status, jlptLevel, page]);

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      setDetail(await fetchUserDetail(id));
    } finally {
      setLoadingDetail(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedId) return;
    setDetail(await fetchUserDetail(selectedId));
  };

  const openEdit = async (id: number) => {
    if (selectedId === id && detail) {
      setEditTarget(detail);
      return;
    }
    setEditLoadingId(id);
    try {
      setEditTarget(await fetchUserDetail(id));
    } finally {
      setEditLoadingId(null);
    }
  };

  const openResetPassword = (u: AdminUserSummary) => setResetPasswordTarget({ id: u.id, username: u.username });

  const handleCreate = async (payload: CreateUserPayload) => {
    setCreating(true);
    try {
      await createUser(payload);
      showToast("Đã tạo tài khoản mới", "success");
      setShowCreateModal(false);
      await Promise.all([loadList(), loadStats()]);
    } catch {
      // reported globally
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (payload: UpdateUserPayload) => {
    if (!editTarget) return;
    setSavingId(editTarget.id);
    try {
      await updateUser(editTarget.id, payload);
      showToast("Đã lưu thay đổi", "success");
      setEditTarget(null);
      if (selectedId === editTarget.id) await refreshDetail();
      await Promise.all([loadList(), loadStats()]);
    } catch {
      // reported globally
    } finally {
      setSavingId(null);
    }
  };

  const handleResetPassword = async (): Promise<string> => {
    if (!resetPasswordTarget) throw new Error("no target");
    const res = await resetUserPassword(resetPasswordTarget.id);
    showToast("Đã tạo mật khẩu mới", "success");
    return res.temporary_password;
  };

  const handleLock = async (reason: string) => {
    if (!lockTarget || !reason) return;
    setSavingId(lockTarget.id);
    try {
      await lockUser(lockTarget.id, reason);
      showToast("Đã khóa tài khoản", "success");
      setLockTarget(null);
      if (selectedId === lockTarget.id) await refreshDetail();
      await Promise.all([loadList(), loadStats()]);
    } catch {
      // reported globally
    } finally {
      setSavingId(null);
    }
  };

  const handleUnlock = async (userId: number) => {
    setSavingId(userId);
    try {
      await unlockUser(userId);
      showToast("Đã mở khóa tài khoản", "success");
      if (selectedId === userId) await refreshDetail();
      await Promise.all([loadList(), loadStats()]);
    } catch {
      // reported globally
    } finally {
      setSavingId(null);
    }
  };

  const handleRowToggleLock = (u: AdminUserSummary) => {
    if (u.is_active) {
      if (u.id === currentUserId) {
        showToast("Không thể tự khóa tài khoản của chính mình", "error");
        return;
      }
      setLockTarget({ id: u.id, username: u.username });
    } else {
      handleUnlock(u.id);
    }
  };

  const toggleSelect = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(items.map((u) => u.id)) : new Set());
  };

  // Only active, non-self accounts can actually be bulk-locked — selecting
  // an already-locked row or your own row just doesn't count toward it.
  const lockableSelectedIds = items
    .filter((u) => selectedIds.has(u.id) && u.is_active && u.id !== currentUserId)
    .map((u) => u.id);

  const handleBulkLock = async (reason: string) => {
    if (!reason || lockableSelectedIds.length === 0) return;
    setBulkLocking(true);
    try {
      const results = await Promise.allSettled(lockableSelectedIds.map((id) => lockUser(id, reason)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const succeeded = results.length - failed;
      if (succeeded > 0) showToast(`Đã khóa ${succeeded} tài khoản${failed ? `, ${failed} lỗi` : ""}`, failed ? "warning" : "success");
      else showToast("Không thể khóa các tài khoản đã chọn", "error");
      setShowBulkLockModal(false);
      setSelectedIds(new Set());
      await Promise.all([loadList(), loadStats()]);
    } finally {
      setBulkLocking(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const modals = (
    <>
      {lockTarget && (
        <LockUserModal
          username={lockTarget.username}
          saving={savingId === lockTarget.id}
          onConfirm={handleLock}
          onClose={() => setLockTarget(null)}
        />
      )}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          isSelf={editTarget.id === currentUserId}
          saving={savingId === editTarget.id}
          onConfirm={handleUpdate}
          onClose={() => setEditTarget(null)}
        />
      )}
      {resetPasswordTarget && (
        <ResetPasswordModal
          username={resetPasswordTarget.username}
          onConfirm={handleResetPassword}
          onClose={() => setResetPasswordTarget(null)}
        />
      )}
      {showCreateModal && (
        <CreateUserModal saving={creating} onConfirm={handleCreate} onClose={() => setShowCreateModal(false)} />
      )}
      {showBulkLockModal && (
        <BulkLockModal
          count={lockableSelectedIds.length}
          saving={bulkLocking}
          onConfirm={handleBulkLock}
          onClose={() => setShowBulkLockModal(false)}
        />
      )}
    </>
  );

  if (selectedId && (detail || loadingDetail)) {
    return (
      <>
        <PageMeta title="Quản lý người dùng | Manabi AI" description="Quản lý người dùng." />
        {loadingDetail || !detail ? (
          <p className="text-sm text-admin-body">Đang tải...</p>
        ) : (
          <UserDetailView
            user={detail}
            isSelf={detail.id === currentUserId}
            onBack={() => {
              setSelectedId(null);
              setDetail(null);
            }}
            onRequestEdit={() => openEdit(detail.id)}
            onRequestResetPassword={() => setResetPasswordTarget({ id: detail.id, username: detail.username })}
            onRequestLock={() => setLockTarget({ id: detail.id, username: detail.username })}
            unlocking={savingId === detail.id}
            onUnlock={() => handleUnlock(detail.id)}
          />
        )}
        {modals}
      </>
    );
  }

  return (
    <>
      <PageMeta title="Quản lý người dùng | Manabi AI" description="Quản lý người dùng." />
      <div className="flex flex-col gap-5">
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => exportUsersCsv(items)}
            disabled={items.length === 0}
            className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input bg-white px-4 py-2.5 text-sm font-medium text-admin-body hover:bg-admin-fill disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" /> Xuất dữ liệu
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={`flex items-center gap-1.5 rounded-[9px] px-4 py-2.5 text-sm font-medium text-white shadow-[0_5px_12px_rgba(49,93,206,0.22)] ${ADMIN_PRIMARY_GRADIENT}`}
          >
            <PlusIcon className="h-4 w-4" /> Thêm người dùng
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tổng người dùng" value={stats?.total ?? 0} icon={<GroupIcon />} tone="neutral" />
          <StatCard label="Đang hoạt động" value={stats?.active ?? 0} icon={<CheckCircleIcon />} tone="success" />
          <StatCard label="Đã khóa" value={stats?.locked ?? 0} icon={<OutlineLockIcon />} tone="danger" />
          <StatCard label="Quản trị viên" value={stats?.admins ?? 0} icon={<UserCircleIcon />} tone="info" />
        </div>

        <div className="rounded-2xl border border-admin-border bg-white shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-admin-border p-4">
            <div className="relative w-full max-w-xs">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-body" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className="w-full rounded-[9px] border border-admin-border-input bg-admin-fill py-2.5 pl-10 pr-3.5 text-sm text-admin-ink outline-none placeholder:text-admin-meta focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatusFilter)}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRoleFilter)}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả vai trò</option>
                <option value="admin">Quản trị viên</option>
                <option value="user">Người dùng</option>
              </select>
              <select
                value={jlptLevel}
                onChange={(e) => setJlptLevel(e.target.value as JlptLevelFilter)}
                className="rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2.5 text-sm text-admin-body outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
              >
                <option value="">Tất cả trình độ</option>
                <option value="N1">N1</option>
                <option value="N2">N2</option>
                <option value="N3">N3</option>
                <option value="N4">N4</option>
                <option value="N5">N5</option>
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-admin-border bg-admin-50 px-4 py-3">
              <span className="text-sm font-medium text-admin-600">Đã chọn {selectedIds.size} người dùng</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sm font-medium text-admin-body hover:text-admin-ink"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                onClick={() => setShowBulkLockModal(true)}
                disabled={lockableSelectedIds.length === 0}
                title={lockableSelectedIds.length === 0 ? "Không có tài khoản nào trong lựa chọn có thể khóa" : undefined}
                className="ml-auto flex items-center gap-1.5 rounded-[9px] bg-[#C94D5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#B23F4D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LockIcon className="h-4 w-4" /> Khóa hàng loạt ({lockableSelectedIds.length})
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-admin-border">
                  <th className="py-4 pl-4 pr-2">
                    <AdminCheckbox
                      checked={items.length > 0 && selectedIds.size === items.length}
                      indeterminate={selectedIds.size > 0 && selectedIds.size < items.length}
                      onChange={toggleSelectAll}
                      ariaLabel="Chọn tất cả"
                    />
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Người dùng
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Vai trò
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Trình độ
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Level / Streak
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Đăng nhập gần nhất
                  </th>
                  <th className="px-4 py-4 text-xs font-bold uppercase tracking-[1.2px] text-admin-body">
                    Trạng thái
                  </th>
                  <th className="px-4 py-4" />
                </tr>
              </thead>
              <tbody>
                {loadingList && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-admin-body">
                      Đang tải...
                    </td>
                  </tr>
                )}
                {!loadingList && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-admin-body">
                      Không tìm thấy người dùng phù hợp.
                    </td>
                  </tr>
                )}
                {items.map((u) => (
                  <UserTableRow
                    key={u.id}
                    user={u}
                    selected={selectedIds.has(u.id)}
                    onToggleSelect={(checked) => toggleSelect(u.id, checked)}
                    onOpen={() => openDetail(u.id)}
                    onEdit={() => openEdit(u.id)}
                    onToggleLock={() => handleRowToggleLock(u)}
                    onResetPassword={() => openResetPassword(u)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-admin-meta">
            Hiển thị {items.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + items.length} trong
            tổng số {total} người dùng
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {editLoadingId != null && (
        <div className="fixed inset-x-0 bottom-4 z-[100000] flex justify-center">
          <div className="rounded-lg bg-admin-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
            Đang tải thông tin...
          </div>
        </div>
      )}

      {modals}
    </>
  );
}
