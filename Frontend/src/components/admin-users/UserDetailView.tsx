import { useEffect, useState } from "react";
import { AdminUserDetail, AdminUserLearningStats, fetchUserLearningStats } from "../../services/adminUserApi";
import { formatApiDateTime } from "../../utils/datetime";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { KeyIcon } from "../../icons/custom";
import { ChevronLeftIcon, PencilIcon } from "../../icons";
import { AccountStatusBadge, RoleBadge } from "./badges";
import UserAvatar from "./UserAvatar";
import {
  ConversationTab,
  JlptTab,
  ListeningTab,
  OverviewTab,
  PersonalInfoTab,
  PROFILE_TABS,
  ProfileTabKey,
  VocabularyTab,
} from "./ProfileTabs";

function displayName(u: AdminUserDetail): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.username;
}

interface Props {
  user: AdminUserDetail;
  isSelf: boolean;
  onBack: () => void;
  onRequestEdit: () => void;
  onRequestResetPassword: () => void;
  onRequestLock: () => void;
  unlocking: boolean;
  onUnlock: () => void;
}

export default function UserDetailView({
  user,
  isSelf,
  onBack,
  onRequestEdit,
  onRequestResetPassword,
  onRequestLock,
  unlocking,
  onUnlock,
}: Props) {
  const [tab, setTab] = useState<ProfileTabKey>("overview");
  const [stats, setStats] = useState<AdminUserLearningStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    fetchUserLearningStats(user.id)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingStats(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const tabProps = { user, stats, loadingStats };

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-admin-body hover:text-admin-ink"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách
      </button>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-admin-border bg-white p-5 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
        <div className="flex items-center gap-4">
          <UserAvatar id={user.id} name={displayName(user)} username={user.username} avatarUrl={user.avatar_url} size={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-admin-ink">{displayName(user)}</h3>
              <RoleBadge role={user.role} />
              <AccountStatusBadge isActive={user.is_active} />
            </div>
            <p className="mt-0.5 text-xs text-admin-meta">
              @{user.username} · ID #{user.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestEdit}
            className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
          >
            <PencilIcon className="h-4 w-4" /> Sửa
          </button>
          <button
            type="button"
            onClick={onRequestResetPassword}
            className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
          >
            <KeyIcon className="h-4 w-4" /> Đặt lại mật khẩu
          </button>
          {user.is_active ? (
            isSelf ? (
              <span className="text-xs text-admin-meta">Không thể tự khóa tài khoản của mình</span>
            ) : (
              <button
                type="button"
                onClick={onRequestLock}
                className="flex items-center gap-1.5 rounded-[9px] bg-[#C94D5C] px-4 py-2 text-sm font-medium text-white hover:bg-[#B23F4D]"
              >
                <LockIcon className="h-4 w-4" /> Khóa tài khoản
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlocking}
              className="flex items-center gap-1.5 rounded-[9px] bg-[#15988E] px-4 py-2 text-sm font-medium text-white hover:bg-[#128178] disabled:opacity-50"
            >
              <UnlockIcon className="h-4 w-4" /> {unlocking ? "Đang mở khóa..." : "Mở khóa"}
            </button>
          )}
        </div>
      </div>

      {!user.is_active && (
        <div className="rounded-2xl border border-[#F3C6CC] bg-[#FDEBEC] p-4 text-sm text-[#C94D5C]">
          <p className="font-medium">Lý do khóa: {user.locked_reason || "Không có ghi chú"}</p>
          <p className="mt-0.5 text-xs opacity-80">Khóa lúc: {formatApiDateTime(user.locked_at)}</p>
        </div>
      )}

      <div className="rounded-2xl border border-admin-border bg-white p-1.5 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
        <div className="flex flex-wrap gap-1">
          {PROFILE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-admin-50 text-admin-600" : "text-admin-body hover:bg-admin-fill"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <OverviewTab {...tabProps} />}
      {tab === "personal" && <PersonalInfoTab {...tabProps} />}
      {tab === "vocabulary" && <VocabularyTab {...tabProps} />}
      {tab === "jlpt" && <JlptTab {...tabProps} />}
      {tab === "conversation" && <ConversationTab {...tabProps} />}
      {tab === "listening" && <ListeningTab {...tabProps} />}
    </div>
  );
}
