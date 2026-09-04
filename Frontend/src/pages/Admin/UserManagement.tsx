import { useCallback, useEffect, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { usePageHeader } from "../../context/PageHeaderContext";
import { useToast } from "../../context/ToastContext";
import { getStoredUser } from "../../services/authApi";
import {
  AdminUserDetail,
  AdminUserSummary,
  CreateUserPayload,
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
import { CheckCircleIcon, GroupIcon, LockIcon as OutlineLockIcon, PlusIcon, UserCircleIcon } from "../../icons";

interface Stats {
  total: number;
  active: number;
  locked: number;
  admins: number;
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

  const currentUserId = getStoredUser()?.id;

  useEffect(() => {
    setPageHeader("Quản lý người dùng", "Xem danh sách, hồ sơ và tình trạng học tập; khóa/mở khóa tài khoản.");
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
      const res = await fetchUsers({ search: search.trim() || undefined, role, status, page });
      setItems(res.items);
      setTotal(res.total);
      setPageSize(res.page_size);
    } finally {
      setLoadingList(false);
    }
  }, [search, role, status, page]);

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
  }, [search, role, status]);

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
    </>
  );

  if (selectedId && (detail || loadingDetail)) {
    return (
      <>
        <PageMeta title="Quản lý người dùng | Manabi AI" description="Quản lý người dùng." />
        {loadingDetail || !detail ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải...</p>
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
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Tổng người dùng" value={stats?.total ?? 0} icon={<GroupIcon />} />
          <StatCard label="Đang hoạt động" value={stats?.active ?? 0} icon={<CheckCircleIcon />} tone="success" />
          <StatCard label="Đã khóa" value={stats?.locked ?? 0} icon={<OutlineLockIcon />} tone="danger" />
          <StatCard label="Quản trị viên" value={stats?.admins ?? 0} icon={<UserCircleIcon />} />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, username hoặc email..."
            className="min-w-[240px] flex-1 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRoleFilter)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="user">Người dùng</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatusFilter)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4" /> Thêm người dùng
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Người dùng
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Vai trò
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Đang tải...
                  </td>
                </tr>
              )}
              {!loadingList && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              )}
              {items.map((u) => (
                <UserTableRow
                  key={u.id}
                  user={u}
                  onOpen={() => openDetail(u.id)}
                  onEdit={() => openEdit(u.id)}
                  onToggleLock={() => handleRowToggleLock(u)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Hiển thị {items.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + items.length} trong
            tổng số {total} người dùng
          </span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {editLoadingId != null && (
        <div className="fixed inset-x-0 bottom-4 z-[100000] flex justify-center">
          <div className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-white dark:text-gray-900">
            Đang tải thông tin...
          </div>
        </div>
      )}

      {modals}
    </>
  );
}
