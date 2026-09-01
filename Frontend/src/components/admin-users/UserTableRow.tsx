import { AdminUserSummary } from "../../services/adminUserApi";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { EyeIcon, PencilIcon, UserCircleIcon } from "../../icons";

function displayName(u: AdminUserSummary): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.username;
}

interface Props {
  user: AdminUserSummary;
  onOpen: () => void;
  onEdit: () => void;
  onToggleLock: () => void;
}

export default function UserTableRow({ user, onOpen, onEdit, onToggleLock }: Props) {
  return (
    <tr className="border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
      <td className="cursor-pointer whitespace-nowrap px-4 py-3" onClick={onOpen}>
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-12 w-10 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700" />
          ) : (
            <UserCircleIcon className="h-12 w-10 shrink-0 text-gray-300 dark:text-gray-600" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{displayName(user)}</p>
            <p className="truncate text-xs text-gray-400 dark:text-gray-500">@{user.username}</p>
          </div>
        </div>
      </td>
      <td className="cursor-pointer px-4 py-3 text-sm text-gray-600 dark:text-gray-300" onClick={onOpen}>
        {user.email}
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3" onClick={onOpen}>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
            user.role === "admin"
              ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
              : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {user.role === "admin" ? "Quản trị viên" : "Người dùng"}
        </span>
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3" onClick={onOpen}>
        {user.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Hoạt động
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Đã khóa
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onOpen} title="Xem chi tiết" className="text-gray-400 hover:text-brand-500">
            <EyeIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Sửa thông tin"
            className="text-gray-400 hover:text-brand-500"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            title={user.is_active ? "Khóa tài khoản" : "Mở khóa tài khoản"}
            className={user.is_active ? "text-gray-400 hover:text-rose-500" : "text-emerald-500 hover:text-emerald-600"}
          >
            {user.is_active ? <LockIcon className="h-4 w-4" /> : <UnlockIcon className="h-4 w-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
