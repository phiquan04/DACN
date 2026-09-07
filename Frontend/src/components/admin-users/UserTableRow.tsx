import { AdminUserSummary } from "../../services/adminUserApi";
import { formatRelativeTime } from "../../utils/datetime";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { KeyIcon } from "../../icons/custom";
import { BoltIcon, EyeIcon, PencilIcon } from "../../icons";
import { AccountStatusBadge, JlptLevelBadge, RoleBadge } from "./badges";
import RowActionsMenu, { RowAction } from "./RowActionsMenu";
import UserAvatar from "../common/UserAvatar";
import AdminCheckbox from "./AdminCheckbox";

function displayName(u: AdminUserSummary): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.username;
}

interface Props {
  user: AdminUserSummary;
  selected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onOpen: () => void;
  onEdit: () => void;
  onToggleLock: () => void;
  onResetPassword: () => void;
}

export default function UserTableRow({ user, selected, onToggleSelect, onOpen, onEdit, onToggleLock, onResetPassword }: Props) {
  const actions: RowAction[] = [
    { label: "Xem chi tiết", icon: <EyeIcon />, onClick: onOpen },
    { label: "Sửa thông tin", icon: <PencilIcon />, onClick: onEdit },
    { label: "Đặt lại mật khẩu", icon: <KeyIcon />, onClick: onResetPassword },
    user.is_active
      ? { label: "Khóa tài khoản", icon: <LockIcon />, onClick: onToggleLock, tone: "danger" }
      : { label: "Mở khóa tài khoản", icon: <UnlockIcon />, onClick: onToggleLock, tone: "success" },
  ];

  return (
    <tr className={`border-b border-admin-border transition-colors last:border-b-0 hover:bg-admin-fill ${selected ? "bg-admin-fill" : ""}`}>
      <td className="whitespace-nowrap py-3.5 pl-4 pr-2">
        <AdminCheckbox checked={selected} onChange={onToggleSelect} ariaLabel={`Chọn ${displayName(user)}`} />
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5" onClick={onOpen}>
        <div className="flex items-center gap-3">
          <UserAvatar id={user.id} name={displayName(user)} username={user.username} avatarUrl={user.avatar_url} zoomable />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-admin-ink">{displayName(user)}</p>
            <p className="truncate text-xs text-admin-meta">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5" onClick={onOpen}>
        <RoleBadge role={user.role} />
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5" onClick={onOpen}>
        <JlptLevelBadge level={user.current_jlpt_level} />
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5" onClick={onOpen}>
        <p className="text-sm font-bold text-admin-ink">Lv. {user.level}</p>
        <p className="flex items-center gap-1 text-xs font-medium text-admin-body">
          <BoltIcon className="h-3 w-3 text-[#B47A1B]" /> {user.streak_days} ngày
        </p>
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5 text-sm font-medium text-admin-body" onClick={onOpen}>
        {formatRelativeTime(user.last_login_at)}
      </td>
      <td className="cursor-pointer whitespace-nowrap px-4 py-3.5" onClick={onOpen}>
        <AccountStatusBadge status={user.account_status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-right">
        <RowActionsMenu actions={actions} />
      </td>
    </tr>
  );
}
