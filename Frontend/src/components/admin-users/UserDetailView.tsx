import { useEffect, useState } from "react";
import {
  AdminActivityEntry,
  AdminUserDetail,
  AdminUserLearningStats,
  UpdateUserPayload,
  fetchUserActivity,
  fetchUserLearningStats,
} from "../../services/adminUserApi";
import { formatApiDate, formatApiDateTime } from "../../utils/datetime";
import { useUrlEnum } from "../../hooks/useUrlState";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { ChevronLeftIcon, ShootingStarIcon } from "../../icons";
import { AccountStatusBadge, EmailVerifiedBadge, JlptLevelBadge } from "./badges";
import UserAvatar from "../common/UserAvatar";
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
  onQuickUpdate: (payload: UpdateUserPayload) => Promise<void>;
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
  onQuickUpdate,
}: Props) {
  const [tab, setTab] = useUrlEnum<ProfileTabKey>(
    "tab",
    ["overview", "personal", "vocabulary", "jlpt", "conversation", "listening"],
    "overview"
  );
  const [stats, setStats] = useState<AdminUserLearningStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activity, setActivity] = useState<AdminActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    setLoadingActivity(true);
    fetchUserActivity(user.id)
      .then((res) => {
        if (!cancelled) setActivity(res);
      })
      .finally(() => {
        if (!cancelled) setLoadingActivity(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const tabProps = {
    user, stats, loadingStats, activity, loadingActivity, onRequestEdit, onRequestResetPassword,
    isSelf, onRequestLock, onUnlock, unlocking, onQuickUpdate,
  };

  return (
    <div className="flex flex-col gap-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-admin-body hover:text-admin-ink"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách
      </button>

      <div className="flex flex-wrap items-stretch gap-6 rounded-2xl border border-admin-border bg-white p-8 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
        <div className="flex flex-1 items-center gap-6">
          <UserAvatar id={user.id} name={displayName(user)} username={user.username} avatarUrl={user.avatar_url} size={104} zoomable />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-2xl font-bold text-admin-ink">{displayName(user)}</h3>
              <AccountStatusBadge status={user.account_status} />
              <EmailVerifiedBadge verified={user.email_verified} />
            </div>
            <p className="mt-1.5 text-base text-admin-meta">
              {user.email} · Tham gia từ {formatApiDate(user.created_at)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center rounded-[6px] bg-[#EDE7FA] px-3 py-1.5 text-sm font-semibold text-[#5B21B6]">
                {user.role === "admin" ? "Quản trị viên" : "Học viên"}
              </span>
              {user.current_jlpt_level && <JlptLevelBadge level={user.current_jlpt_level} />}
              {user.is_active ? (
                !isSelf && (
                  <button
                    type="button"
                    onClick={onRequestLock}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#FDEBEC] px-3 py-1.5 text-sm font-semibold text-[#C94D5C] hover:bg-[#F9D8DE]"
                  >
                    <LockIcon className="h-4 w-4" /> Khóa
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onUnlock}
                  disabled={unlocking}
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#E4F5F1] px-3 py-1.5 text-sm font-semibold text-[#15988E] hover:bg-[#D2EEE7] disabled:opacity-50"
                >
                  <UnlockIcon className="h-4 w-4" /> {unlocking ? "Đang mở khóa..." : "Mở khóa"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden self-stretch border-l border-admin-border sm:block" />

        <div className="flex shrink-0 items-center pl-2 sm:pl-10">
          <div className="text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">Tổng XP</p>
            <p className="mt-1 text-3xl font-bold leading-tight text-admin-ink">{user.vocab_xp.toLocaleString("vi-VN")}</p>
            <p className="mt-1.5 flex items-center justify-end gap-1 text-xs font-semibold text-[#B47A1B]">
              <ShootingStarIcon className="h-3.5 w-3.5" /> Top {user.xp_percentile_top}% học viên
            </p>
          </div>
        </div>
      </div>

      {!user.is_active && (
        <div className="rounded-2xl border border-[#F3C6CC] bg-[#FDEBEC] p-4 text-sm text-[#C94D5C]">
          <p className="font-medium">Lý do khóa: {user.locked_reason || "Không có ghi chú"}</p>
          <p className="mt-0.5 text-xs opacity-80">Khóa lúc: {formatApiDateTime(user.locked_at)}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-6 border-b border-admin-border">
        {PROFILE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative -mb-px border-b-2 pb-3 text-sm transition-colors ${
              tab === t.key
                ? "border-admin-500 font-semibold text-admin-600"
                : "border-transparent font-medium text-admin-body hover:text-admin-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
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
