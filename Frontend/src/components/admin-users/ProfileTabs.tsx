import { ComponentType, ReactNode, useCallback, useEffect, useState } from "react";
import {
  AdminActivityEntry,
  AdminUserConversationDetail,
  AdminUserDetail,
  AdminUserJlptDetail,
  AdminUserLearningStats,
  AdminUserListeningDetail,
  AdminUserVocabularyDetail,
  UpdateUserPayload,
  clearUserConversationGrammarHistory,
  clearUserSearchHistory,
  fetchUserConversationDetail,
  fetchUserJlptDetail,
  fetchUserListeningDetail,
  fetchUserVocabularyDetail,
  resetUserVocabularySrs,
} from "../../services/adminUserApi";
import { SectionType } from "../../services/jlptApi";
import { useToast } from "../../context/ToastContext";
import { formatApiDate, formatApiDateTime, formatRelativeTime, parseApiDate } from "../../utils/datetime";
import { GlobeIcon, KeyIcon, PhoneIcon, RefreshIcon, ClockIcon, SearchIcon } from "../../icons/custom";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import {
  AlertIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  AudioIcon,
  BoltIcon,
  BoxIconLine,
  CalenderIcon,
  ChatIcon,
  CheckCircleIcon,
  DocsIcon,
  DownloadIcon,
  MailIcon,
  PencilIcon,
  PieChartIcon,
  ShootingStarIcon,
  TaskIcon,
  TrashBinIcon,
  UserCircleIcon,
  UserIcon,
  VideoIcon,
} from "../../icons";
import StatCard, { StatTone, TONE_COLORS } from "../admin-vocabulary/StatCard";
import { AccountStatusBadge, EmailVerifiedBadge, JlptLevelBadge } from "./badges";
import ClearConversationGrammarModal from "./ClearConversationGrammarModal";
import ClearSearchHistoryModal from "./ClearSearchHistoryModal";
import ConversationTranscriptModal from "./ConversationTranscriptModal";
import JlptAttemptReviewModal from "./JlptAttemptReviewModal";
import ResetVocabSrsModal from "./ResetVocabSrsModal";

const SET_STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-[#FFF3D9] text-[#B47A1B]",
  info: "bg-[#E6F1FC] text-[#4B91D2]",
  success: "bg-[#E4F5F1] text-[#15988E]",
};

function exportVocabularySetsCsv(user: AdminUserDetail, detail: AdminUserVocabularyDetail) {
  const header = ["Bộ từ vựng", "Trình độ", "Tổng số từ", "Số từ đã học", "Số từ đã thuộc", "Tiến độ (%)", "Trạng thái"];
  const rows = detail.sets.map((s) => [
    s.set_name, s.level, s.item_count, s.progress_count, s.mastered_count, s.percent, s.status_label,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tu-vung-${user.username}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const JLPT_SECTION_ORDER: SectionType[] = ["kotoba", "dokkai", "choukai"];
const JLPT_SECTION_TABLE_LABELS: Record<SectionType, string> = {
  kotoba: "Từ vựng - Hán tự",
  dokkai: "Ngữ pháp - Đọc hiểu",
  choukai: "Nghe hiểu",
};

function exportJlptHistoryCsv(user: AdminUserDetail, detail: AdminUserJlptDetail) {
  const header = [
    "Đề thi", "Trình độ", "Ngày thi",
    ...JLPT_SECTION_ORDER.map((t) => JLPT_SECTION_TABLE_LABELS[t]),
    "Tổng điểm", "Thời gian (phút)", "Kết quả",
  ];
  const rows = detail.attempts.map((a) => {
    const scoreByType = new Map(a.sections.map((s) => [s.section_type, s]));
    return [
      a.exam_title, a.level, formatApiDate(a.submitted_at),
      ...JLPT_SECTION_ORDER.map((t) => {
        const s = scoreByType.get(t);
        return s ? `${s.score}/${s.max}` : "—";
      }),
      `${a.total}/${a.total_max}`, a.duration_minutes ?? "—",
      a.is_pass ? "Đạt" : "Chưa đạt",
    ];
  });
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jlpt-${user.username}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function exportLookupHistoryCsv(user: AdminUserDetail, detail: AdminUserListeningDetail) {
  const header = ["Từ vựng", "Cách đọc", "Nghĩa", "Cấp độ JLPT", "Thời gian tra"];
  const rows = detail.recent_lookups.map((r) => [r.word, r.reading ?? "", r.meaning ?? "", r.jlpt ?? "", formatApiDateTime(r.created_at)]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tra-cuu-tu-dien-${user.username}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportConversationHistoryCsv(user: AdminUserDetail, detail: AdminUserConversationDetail) {
  const header = ["Hội thoại", "Tình huống", "Số lượt hội thoại", "Số lỗi ngữ pháp", "Bắt đầu", "Tin nhắn cuối"];
  const rows = detail.conversations.map((c) => [
    c.title || c.scenario_title || "Hội thoại tự do", c.scenario_title ?? "",
    c.message_count, c.error_count, formatApiDateTime(c.started_at), formatApiDateTime(c.last_message_at),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hoi-thoai-${user.username}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function calcAge(dob?: string | null): number | null {
  const d = parseApiDate(dob);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Default daily vocabulary goal when the user hasn't set one — mirrors
// DAILY_GOAL_WORDS in Backend/app/routes/vocabulary/learning.py.
const DEFAULT_DAILY_GOAL = 20;

export type ProfileTabKey = "overview" | "personal" | "vocabulary" | "jlpt" | "conversation" | "listening";

export const PROFILE_TABS: { key: ProfileTabKey; label: string }[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "personal", label: "Thông tin cá nhân" },
  { key: "vocabulary", label: "Từ vựng" },
  { key: "jlpt", label: "JLPT" },
  { key: "conversation", label: "Hội thoại & Ngữ pháp" },
  { key: "listening", label: "Nghe & Từ điển" },
];

const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

export function InfoField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-admin-meta">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </p>
      <p className="mt-0.5 text-sm text-admin-ink">{value || "—"}</p>
    </div>
  );
}

export function StatMini({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-4 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <p className="flex items-center gap-1.5 text-xs font-medium text-admin-meta">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-admin-ink">{value}</p>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon,
  tone = "neutral",
  badge,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  tone?: StatTone;
  badge?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { fill, ink } = TONE_COLORS[tone];
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] [&>svg]:h-5 [&>svg]:w-5"
              style={{ backgroundColor: fill, color: ink }}
            >
              {icon}
            </span>
          )}
          <div>
            <h4 className="text-base font-semibold text-admin-ink">{title}</h4>
            {subtitle && <p className="text-sm text-admin-body">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-admin-fill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-body">
              {badge}
            </span>
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex h-[120px] items-center justify-center text-sm text-admin-meta">{text}</div>;
}

interface TabProps {
  user: AdminUserDetail;
  stats: AdminUserLearningStats | null;
  loadingStats: boolean;
  activity?: AdminActivityEntry[];
  loadingActivity?: boolean;
  onRequestEdit?: () => void;
  onRequestResetPassword?: () => void;
  isSelf?: boolean;
  onQuickUpdate?: (payload: UpdateUserPayload) => Promise<void>;
}

function ActivityRow({ tone, icon, title, time }: { tone: StatTone; icon: ReactNode; title: string; time: string }) {
  const { fill, ink } = TONE_COLORS[tone];
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4"
        style={{ backgroundColor: fill, color: ink }}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm text-admin-ink">{title}</p>
        <p className="text-xs text-admin-meta">{time}</p>
      </div>
    </li>
  );
}

// Maps an AuditLog `action` code (see Backend/app/models/audit_log.py) to
// how its row renders in the activity feed. Falls back to a plain calendar
// icon for any action added later that isn't in this list yet.
const ACTIVITY_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: StatTone }> = {
  "admin.user_created": { icon: UserIcon, tone: "neutral" },
  "admin.user_updated": { icon: PencilIcon, tone: "neutral" },
  "admin.user_locked": { icon: LockIcon, tone: "danger" },
  "admin.user_unlocked": { icon: UnlockIcon, tone: "success" },
  "admin.password_reset": { icon: KeyIcon, tone: "pending" },
  "admin.note_updated": { icon: DocsIcon, tone: "neutral" },
  "admin.vocab_srs_reset": { icon: RefreshIcon, tone: "pending" },
  "admin.search_history_cleared": { icon: TrashBinIcon, tone: "danger" },
  "auth.login": { icon: BoltIcon, tone: "pending" },
  "auth.email_verified": { icon: MailIcon, tone: "success" },
  "vocab.daily_goal_met": { icon: DocsIcon, tone: "success" },
  "vocab.achievement_unlocked": { icon: ShootingStarIcon, tone: "success" },
  "chat.conversation_started": { icon: ChatIcon, tone: "neutral" },
  "jlpt.test_completed": { icon: TaskIcon, tone: "info" },
};
const DEFAULT_ACTIVITY_META = { icon: CalenderIcon, tone: "neutral" as StatTone };

export function OverviewTab({ user, stats, loadingStats, activity, loadingActivity }: TabProps) {
  const dailyGoal = user.daily_vocab_goal ?? DEFAULT_DAILY_GOAL;
  const studiedToday = stats?.vocabulary.studied_today ?? 0;
  const vocabProgress = Math.min(100, Math.round((studiedToday / Math.max(1, dailyGoal)) * 100));
  const hours = Math.floor(user.total_study_minutes / 60);
  const minutes = user.total_study_minutes % 60;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Streak hiện tại" value={`${user.streak_days} ngày`} icon={<BoltIcon />} tone="pending" />
        <StatCard
          label="Từ vựng đã học"
          value={loadingStats || !stats ? "—" : stats.vocabulary.learned}
          icon={<DocsIcon />}
          tone="info"
        />
        <StatCard
          label="Bài đã hoàn thành"
          value={loadingStats || !stats ? "—" : stats.jlpt.completed}
          icon={<BoxIconLine />}
          tone="neutral"
        />
        <StatCard label="Thời gian học" value={`${hours}h ${minutes}m`} icon={<BoltIcon />} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Tiến độ học tập" subtitle="Tiến độ mục tiêu từ vựng hôm nay">
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-sm font-medium text-admin-body">Từ vựng</span>
                <span className="text-xs text-admin-meta">{vocabProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-admin-fill">
                <div className="h-full rounded-full bg-admin-500" style={{ width: `${vocabProgress}%` }} />
              </div>
              <p className="mt-2 text-xs text-admin-meta">
                Đã học {studiedToday}/{dailyGoal} từ hôm nay để giữ streak
              </p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Hoạt động gần đây">
          {loadingActivity ? (
            <EmptyState text="Đang tải dữ liệu..." />
          ) : activity && activity.length > 0 ? (
            <ul className="space-y-3">
              {activity.map((a) => {
                const meta = ACTIVITY_META[a.action] ?? DEFAULT_ACTIVITY_META;
                const Icon = meta.icon;
                return (
                  <ActivityRow
                    key={a.id}
                    tone={meta.tone}
                    icon={<Icon />}
                    title={a.description}
                    time={formatApiDateTime(a.created_at)}
                  />
                );
              })}
            </ul>
          ) : (
            // No audit-log rows yet for this user (e.g. their account predates
            // this feature) — fall back to what's derivable from existing
            // timestamp columns instead of showing an empty card.
            <ul className="space-y-3">
              <ActivityRow tone="pending" icon={<BoltIcon />} title="Đăng nhập gần nhất" time={formatApiDateTime(user.last_login_at)} />
              <ActivityRow
                tone="neutral"
                icon={<PencilIcon />}
                title="Cập nhật hồ sơ gần nhất"
                time={formatApiDateTime(user.profile_updated_at)}
              />
              <ActivityRow tone="success" icon={<CalenderIcon />} title="Tạo tài khoản" time={formatApiDateTime(user.created_at)} />
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function displayFullName(user: AdminUserDetail): string {
  return [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username;
}

export function PersonalInfoTab({
  user,
  onRequestEdit,
  onRequestResetPassword,
  isSelf,
  onQuickUpdate,
  activity,
  loadingActivity,
}: TabProps) {
  const { showToast } = useToast();
  const [savingRole, setSavingRole] = useState(false);
  const [note, setNote] = useState(user.admin_note ?? "");
  const [savingNote, setSavingNote] = useState(false);

  // Keep the textarea in sync when a different user's detail is opened, or
  // after a save round-trips and refreshes `user` from the server.
  useEffect(() => setNote(user.admin_note ?? ""), [user.id, user.admin_note]);

  const handleRoleChange = async (role: "admin" | "user") => {
    if (!onQuickUpdate || role === user.role) return;
    setSavingRole(true);
    try {
      await onQuickUpdate({ role });
      showToast("Đã cập nhật vai trò hệ thống", "success");
    } catch {
      // reported globally
    } finally {
      setSavingRole(false);
    }
  };

  const handleSaveNote = async () => {
    if (!onQuickUpdate) return;
    setSavingNote(true);
    try {
      await onQuickUpdate({ admin_note: note.trim() || null });
      showToast("Đã lưu ghi chú nội bộ", "success");
    } catch {
      // reported globally
    } finally {
      setSavingNote(false);
    }
  };

  const age = calcAge(user.date_of_birth);

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <SectionCard
          icon={<UserIcon />}
          title="Thông tin cơ bản & Liên hệ"
          subtitle="Hồ sơ do người dùng khai báo hoặc admin chỉnh sửa"
          actions={
            <button
              type="button"
              onClick={onRequestEdit}
              className="flex items-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
            >
              <PencilIcon className="h-4 w-4" /> Chỉnh sửa
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <InfoField icon={<UserIcon />} label="Họ và tên" value={displayFullName(user)} />
            <InfoField icon={<UserIcon />} label="Tên đăng nhập (Username)" value={`@${user.username}`} />
            <div>
              <p className="flex items-center gap-1.5 text-xs font-medium text-admin-meta">
                <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
                  <MailIcon />
                </span>
                Địa chỉ Email
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-admin-ink">
                {user.email}
                <EmailVerifiedBadge verified={user.email_verified} />
              </p>
            </div>
            <InfoField icon={<PhoneIcon />} label="Số điện thoại" value={user.phone ?? ""} />
            <InfoField
              icon={<CalenderIcon />}
              label="Ngày sinh"
              value={user.date_of_birth ? `${formatApiDate(user.date_of_birth)}${age != null ? ` (${age} tuổi)` : ""}` : ""}
            />
            <InfoField
              icon={<UserCircleIcon />}
              label="Giới tính"
              value={user.gender ? GENDER_LABELS[user.gender] ?? user.gender : ""}
            />
            <InfoField
              icon={<GlobeIcon />}
              label="Địa chỉ / Khu vực"
              value={[user.city, user.country].filter(Boolean).join(", ")}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-admin-fill p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">Ngày đăng ký</p>
              <p className="mt-0.5 text-sm font-medium text-admin-ink">{formatApiDateTime(user.created_at)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">Đăng nhập cuối</p>
              <p className="mt-0.5 text-sm font-medium text-admin-ink">
                {user.last_login_at ? formatApiDateTime(user.last_login_at) : "Chưa từng đăng nhập"}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-5">
        <SectionCard icon={<LockIcon />} tone="pending" title="Tài khoản & Bảo mật" badge="ADMIN CONTROL">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium text-admin-meta">Vai trò hệ thống</p>
              <select
                value={user.role}
                disabled={isSelf || savingRole}
                title={isSelf ? "Không thể tự đổi vai trò của chính mình" : undefined}
                onChange={(e) => handleRoleChange(e.target.value as "admin" | "user")}
                className="mt-1.5 w-full rounded-[9px] border border-admin-border-input bg-white px-3.5 py-2 text-sm text-admin-ink outline-none focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18 disabled:opacity-50"
              >
                <option value="user">Học viên tiêu chuẩn</option>
                <option value="admin">Quản trị viên</option>
              </select>
              <p className="mt-1 text-xs text-admin-meta">Quyền hạn truy cập nội dung</p>
            </div>

            <div className="rounded-xl bg-admin-fill p-3.5">
              <p className="text-xs font-medium text-admin-meta">Trạng thái tài khoản</p>
              <p className="mt-1">
                <AccountStatusBadge status={user.account_status} />
              </p>
            </div>

            <button
              type="button"
              onClick={onRequestResetPassword}
              className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
            >
              <KeyIcon className="h-4 w-4" /> Đặt lại mật khẩu
            </button>
          </div>
        </SectionCard>

        <SectionCard icon={<DocsIcon />} title="Nhật ký thay đổi & Ghi chú">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[1.2px] text-admin-meta">Lịch sử gần đây</p>
            {loadingActivity ? (
              <EmptyState text="Đang tải dữ liệu..." />
            ) : activity && activity.length > 0 ? (
              <ul className="space-y-3">
                {activity.map((a) => {
                  const meta = ACTIVITY_META[a.action] ?? DEFAULT_ACTIVITY_META;
                  const Icon = meta.icon;
                  return (
                    <ActivityRow
                      key={a.id}
                      tone={meta.tone}
                      icon={<Icon />}
                      title={a.description}
                      time={formatApiDateTime(a.created_at)}
                    />
                  );
                })}
              </ul>
            ) : (
              <EmptyState text="Chưa có hoạt động nào được ghi nhận." />
            )}
          </div>

          <div className="mt-5 border-t border-admin-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[1.2px] text-admin-meta">Ghi chú nội bộ Admin</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="Ghi chú riêng cho đội ngũ quản trị — học viên không nhìn thấy nội dung này."
              className="w-full resize-none rounded-[9px] border border-admin-border-input bg-admin-fill px-3.5 py-2.5 text-sm text-admin-ink outline-none placeholder:text-admin-meta focus:border-admin-200 focus:ring-3 focus:ring-admin-500/18"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={savingNote || note === (user.admin_note ?? "")}
                className="rounded-[9px] bg-admin-500 px-4 py-2 text-sm font-medium text-white hover:bg-admin-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingNote ? "Đang lưu..." : "Lưu ghi chú"}
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function VocabularyTab({ user }: TabProps) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<AdminUserVocabularyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchUserVocabularyDetail(user.id));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResetSrs = async () => {
    setResetting(true);
    try {
      setDetail(await resetUserVocabularySrs(user.id));
      showToast("Đã đặt lại chu kỳ SRS từ vựng", "success");
      setShowResetModal(false);
    } catch {
      // reported globally
    } finally {
      setResetting(false);
    }
  };

  if (loading || !detail) return <EmptyState text="Đang tải dữ liệu..." />;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DocsIcon />}
          tone="neutral"
          label="Tổng từ đã học"
          value={detail.total_touched}
          sub={detail.studied_today > 0 ? `+${detail.studied_today} từ hôm nay` : "Chưa học từ nào hôm nay"}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          tone="success"
          label="Thuộc vĩnh viễn (Mastered)"
          value={detail.mastered}
          sub={`${detail.mastered_percent}% tổng số từ đã học`}
        />
        <StatCard
          icon={<ClockIcon />}
          tone="pending"
          label="Cần ôn tập hôm nay"
          value={detail.due_today}
          sub="SRS đến hạn ôn tập"
        />
        <StatCard
          icon={<ArrowUpIcon />}
          tone="info"
          label="Tỷ lệ nhớ đúng"
          value={detail.accuracy_percent != null ? `${detail.accuracy_percent}%` : "—"}
          sub={detail.accuracy_label}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <SectionCard
            icon={<DocsIcon />}
            title="Danh sách bộ từ vựng đã ghi danh"
            actions={<span className="text-sm text-admin-meta">{detail.sets.length} bộ tài liệu</span>}
          >
            {detail.sets.length === 0 ? (
              <EmptyState text="Người dùng chưa bắt đầu học bộ từ vựng nào." />
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.sets.map((s) => (
                  <li key={s.id} className="rounded-xl border border-admin-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <JlptLevelBadge level={s.level} />
                      <span className="text-sm font-semibold text-admin-ink">{s.set_name}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${SET_STATUS_BADGE_CLASS[s.status_tone]}`}>
                        {s.status_label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-admin-meta">
                      Tổng {s.item_count} từ • SRS Mastered: {s.mastered_count} từ
                    </p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-admin-fill">
                        <div className="h-full rounded-full bg-admin-500" style={{ width: `${s.percent}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-semibold text-admin-600">{s.percent}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={<PieChartIcon />}
            title="Phân bố ghi nhớ theo thuật toán SRS (Spaced Repetition)"
            actions={<span className="text-sm text-admin-meta">{detail.total_touched.toLocaleString("vi-VN")} từ đang theo dõi</span>}
          >
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-admin-fill">
              {detail.srs_distribution.map((b) => {
                const percent = detail.total_touched > 0 ? (b.count / detail.total_touched) * 100 : 0;
                return percent > 0 ? (
                  <div key={b.label} className="h-full" style={{ width: `${percent}%`, backgroundColor: TONE_COLORS[b.tone].ink }} />
                ) : null;
              })}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {detail.srs_distribution.map((b) => (
                <div key={b.label} className="rounded-xl border border-admin-border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-admin-body">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_COLORS[b.tone].ink }} />
                    {b.label}
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-admin-ink">
                    {b.count.toLocaleString("vi-VN")} <span className="text-xs font-normal text-admin-meta">từ</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-admin-meta">{b.sublabel}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard icon={<RefreshIcon />} tone="pending" title="Can thiệp Admin" badge="ADMIN VOCABULARY">
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <RefreshIcon className="h-4 w-4" /> Reset chu kỳ SRS từ vựng
              </button>
              <button
                type="button"
                onClick={() => exportVocabularySetsCsv(user, detail)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <DownloadIcon className="h-4 w-4" /> Xuất dữ liệu học tập (.csv)
              </button>
            </div>
          </SectionCard>

          <SectionCard
            icon={<AlertIcon />}
            tone="danger"
            title="Từ vựng hay quên"
            subtitle="Tỷ lệ sai cao"
            badge={`${detail.weak_words.length} từ tiêu biểu`}
          >
            {detail.weak_words.length === 0 ? (
              <EmptyState text="Chưa phát hiện từ vựng nào bị quên nhiều." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {detail.weak_words.map((w) => (
                  <li key={w.word} className="flex items-center justify-between gap-3 rounded-xl border border-admin-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-admin-ink" lang="ja" title={w.word}>
                        {w.word}
                        {w.reading && <span className="ml-1 font-normal text-admin-body">({w.reading})</span>}
                      </p>
                      <p className="truncate text-xs text-admin-meta">{w.meaning_vi}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#FDEBEC] px-2.5 py-1 text-xs font-semibold text-[#C94D5C]">
                      Sai {w.again_count} lần
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {showResetModal && (
        <ResetVocabSrsModal
          username={user.username}
          saving={resetting}
          onConfirm={handleResetSrs}
          onClose={() => setShowResetModal(false)}
        />
      )}
    </div>
  );
}

export function JlptTab({ user }: TabProps) {
  const [detail, setDetail] = useState<AdminUserJlptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewAttemptId, setReviewAttemptId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUserJlptDetail(user.id)
      .then((res) => {
        if (!cancelled) setDetail(res);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  if (loading || !detail) return <EmptyState text="Đang tải dữ liệu..." />;

  const maxProgress = Math.max(180, ...detail.progress.map((p) => p.total));
  const nextTargetDate = detail.next_target ? new Date(detail.next_target.exam_date) : null;

  // Two attempts on the same calendar day (e.g. a quick retry) otherwise
  // print the exact same "dd/mm" x-axis label on adjacent bars — add the
  // time only for the labels that actually collide.
  const dateLabelCounts: Record<string, number> = {};
  detail.progress.forEach((p) => {
    dateLabelCounts[p.label] = (dateLabelCounts[p.label] ?? 0) + 1;
  });
  const progressLabels = detail.progress.map((p) => {
    if (dateLabelCounts[p.label] <= 1) return p.label;
    const time = parseApiDate(p.submitted_at)?.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return time ? `${p.label} ${time}` : p.label;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DocsIcon />}
          tone="info"
          label="Điểm thi thử trung bình"
          value={detail.average_total != null ? `${detail.average_total}/180` : "—"}
          sub={
            detail.delta_total != null ? (
              <span className={`flex items-center gap-1 ${detail.delta_total >= 0 ? "text-[#15988E]" : "text-[#C94D5C]"}`}>
                {detail.delta_total >= 0 ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                {Math.abs(detail.delta_total)} điểm so với lần thi trước
              </span>
            ) : undefined
          }
        />
        <StatCard
          icon={<TaskIcon />}
          tone="neutral"
          label="Số đề đã hoàn thành"
          value={detail.attempts_total}
          sub={detail.attempts_total > detail.attempts.length ? `Hiển thị ${detail.attempts.length} đề gần nhất` : undefined}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          tone="success"
          label="Tỷ lệ đạt ước tính"
          value={detail.pass_estimate_percent != null ? `${detail.pass_estimate_percent}%` : "—"}
          sub="Ước tính dựa trên kết quả các lần thi"
        />
        <StatCard
          icon={<ShootingStarIcon />}
          tone="pending"
          label="Mục tiêu tiếp theo"
          value={user.target_jlpt_level ?? "—"}
          sub={
            nextTargetDate
              ? `Dự kiến ${nextTargetDate.getMonth() + 1}/${nextTargetDate.getFullYear()} (còn ${detail.next_target!.months_left} tháng)`
              : "Chưa đặt kỳ thi mục tiêu"
          }
        />
      </div>

      {detail.attempts.length === 0 ? (
        <SectionCard icon={<DocsIcon />} title="Lịch sử thi thử JLPT">
          <EmptyState text="Người dùng chưa hoàn thành đề thi thử nào." />
        </SectionCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-5 lg:col-span-2">
            <SectionCard
              icon={<DocsIcon />}
              title="Lịch sử thi thử JLPT (Mock Exams)"
              actions={<span className="text-sm text-admin-meta">Hiển thị {detail.attempts.length} đề thi gần nhất</span>}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">
                      <th className="pb-3 pr-3">Tên đề thi &amp; ngày thi</th>
                      <th className="pb-3 pr-3">Tổng điểm</th>
                      <th className="pb-3 pr-3">Chi tiết kỹ năng</th>
                      <th className="pb-3 pr-3">Thời gian</th>
                      <th className="pb-3 pr-3">Kết quả</th>
                      <th className="pb-3">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.attempts.map((a) => {
                      const scoreByType = new Map(a.sections.map((s) => [s.section_type, s]));
                      return (
                        <tr key={a.attempt_id} className="border-t border-admin-border align-top">
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-admin-ink">{a.exam_title}</p>
                            <p className="text-xs text-admin-meta">{formatApiDate(a.submitted_at)}</p>
                          </td>
                          <td className="py-3 pr-3 font-semibold text-admin-ink">
                            {a.total}/{a.total_max}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="flex flex-col gap-0.5 text-xs text-admin-body">
                              {JLPT_SECTION_ORDER.map((t) => {
                                const s = scoreByType.get(t);
                                return s ? (
                                  <span key={t}>
                                    {JLPT_SECTION_TABLE_LABELS[t]}:{" "}
                                    <span className="font-medium text-admin-ink">
                                      {s.score}/{s.max}
                                    </span>
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </td>
                          <td className="py-3 pr-3 text-admin-body">
                            {a.duration_minutes != null ? `${a.duration_minutes} phút` : "—"}
                          </td>
                          <td className="py-3 pr-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                a.is_pass ? "bg-[#E4F5F1] text-[#15988E]" : "bg-[#FBE9ED] text-[#C26678]"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${a.is_pass ? "bg-[#15988E]" : "bg-[#C26678]"}`} />
                              {a.is_pass ? "Đạt" : "Chưa đạt"}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => setReviewAttemptId(a.attempt_id)}
                              className="font-medium text-admin-600 hover:underline"
                            >
                              Xem bài làm
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              icon={<BoxIconLine />}
              title={`Phân tích năng lực chi tiết theo Mondai${detail.scope_level ? ` (${detail.scope_level})` : ""}`}
              actions={
                detail.latest_attempt_label ? (
                  <span className="rounded-full bg-admin-fill px-2.5 py-1 text-[11px] font-medium text-admin-body">
                    Dựa trên đề mới nhất
                  </span>
                ) : undefined
              }
            >
              {detail.latest_mondai_breakdown.length === 0 ? (
                <EmptyState text="Chưa có dữ liệu chi tiết theo Mondai." />
              ) : (
                <ul className="flex flex-col gap-4">
                  {detail.latest_mondai_breakdown.map((m) => {
                    const { fill, ink } = TONE_COLORS[m.tier_tone];
                    return (
                      <li key={`${m.section_name}-${m.mondai_no}`}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium text-admin-ink">
                            Mondai {m.mondai_no}
                            {m.name ? `: ${m.name}` : ""}
                            <span className="ml-1.5 text-xs font-normal text-admin-meta">({m.section_name})</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{ backgroundColor: fill, color: ink }}
                            >
                              {m.tier_label}
                            </span>
                            <span className="w-10 text-right text-xs font-semibold text-admin-ink">{m.percent}%</span>
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-admin-fill">
                          <div className="h-full rounded-full" style={{ width: `${m.percent}%`, backgroundColor: ink }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-5">
            <SectionCard
              icon={<ArrowUpIcon />}
              tone="success"
              title="Lộ trình & Dự báo"
              subtitle={
                detail.delta_total != null
                  ? `Tiến độ tăng điểm ${detail.delta_total >= 0 ? "+" : ""}${detail.delta_total} điểm`
                  : undefined
              }
            >
              {detail.progress.length > 1 ? (
                <div className="flex items-end gap-3">
                  {detail.progress.map((p, i) => (
                    <div key={p.attempt_id} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-xs font-semibold text-admin-ink">{p.total}</span>
                      {/* Fixed pixel height on the track itself — a percentage height only
                          resolves against an ancestor with a definite (not auto/content-fit)
                          height, which the old flex-1-in-a-flex-column wrapper never had. */}
                      <div className="flex h-24 w-full items-end overflow-hidden rounded-t-md bg-admin-fill">
                        <div
                          className="w-full rounded-t-md bg-admin-500"
                          style={{
                            height: `${Math.max(6, (p.total / maxProgress) * 100)}%`,
                            opacity: 0.4 + (i / Math.max(1, detail.progress.length - 1)) * 0.6,
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-admin-meta">{progressLabels[i]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Cần ít nhất 2 lần thi để vẽ tiến trình điểm." />
              )}
            </SectionCard>

            <SectionCard icon={<PieChartIcon />} tone="info" title="Nhận định">
              {detail.insight_message ? (
                <p className="text-sm leading-relaxed text-admin-body">{detail.insight_message}</p>
              ) : (
                <EmptyState text="Chưa có đủ dữ liệu để đưa ra nhận định." />
              )}
            </SectionCard>

            <SectionCard icon={<BoltIcon />} tone="pending" title="Hành động Admin" badge="ADMIN JLPT">
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => exportJlptHistoryCsv(user, detail)}
                  className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
                >
                  <DownloadIcon className="h-4 w-4" /> Xuất bảng điểm (.csv)
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {reviewAttemptId != null && (
        <JlptAttemptReviewModal userId={user.id} attemptId={reviewAttemptId} onClose={() => setReviewAttemptId(null)} />
      )}
    </div>
  );
}

export function ConversationTab({ user }: TabProps) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<AdminUserConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [transcriptId, setTranscriptId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchUserConversationDetail(user.id));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearGrammar = async () => {
    setClearing(true);
    try {
      setDetail(await clearUserConversationGrammarHistory(user.id));
      showToast("Đã đặt lại dữ liệu ngữ pháp hội thoại", "success");
      setShowClearModal(false);
    } catch {
      // reported globally
    } finally {
      setClearing(false);
    }
  };

  if (loading || !detail) return <EmptyState text="Đang tải dữ liệu..." />;

  const maxErrorTypeCount = Math.max(1, ...detail.top_error_types.map((t) => t.count));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ChatIcon />}
          tone="neutral"
          label="Tổng cuộc hội thoại AI"
          value={detail.total_conversations}
          sub={`${detail.total_messages_sent} lượt nhắn tin`}
        />
        <StatCard
          icon={<ClockIcon />}
          tone="info"
          label="Thời lượng đàm thoại"
          value={formatDurationMinutes(detail.total_duration_minutes)}
          sub="Ước tính từ hoạt động nhắn tin"
        />
        <StatCard
          icon={<AlertIcon />}
          tone="pending"
          label="Lỗi ngữ pháp đã ghi nhận"
          value={detail.total_errors}
          sub={`${detail.grammar_checks} lượt chấm`}
        />
        <StatCard
          icon={<CheckCircleIcon />}
          tone="success"
          label="Tỷ lệ câu đúng ngữ pháp"
          value={detail.correct_message_rate != null ? `${detail.correct_message_rate}%` : "—"}
          sub="Trong số câu đã được AI chấm"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <SectionCard
            icon={<ChatIcon />}
            title="Lịch sử luyện đàm thoại với AI"
            actions={<span className="text-sm text-admin-meta">Hiển thị {detail.conversations.length}/{detail.total_conversations} cuộc</span>}
          >
            {detail.conversations.length === 0 ? (
              <EmptyState text="Người dùng chưa luyện hội thoại AI lần nào." />
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.conversations.map((c) => (
                  <li key={c.id} className="rounded-xl border border-admin-border p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {c.scenario_level && <JlptLevelBadge level={c.scenario_level} />}
                        <span className="truncate text-sm font-semibold text-admin-ink" lang="ja" title={c.title ?? undefined}>
                          {c.title || c.scenario_title || "Hội thoại tự do"}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-admin-meta">{formatApiDate(c.last_message_at)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-admin-meta">
                      <span>{c.message_count} lượt hội thoại</span>
                      {c.error_count > 0 ? (
                        <span className="rounded-full bg-[#FDEBEC] px-2 py-0.5 font-semibold text-[#C94D5C]">{c.error_count} lỗi ngữ pháp</span>
                      ) : (
                        <span className="rounded-full bg-[#E4F5F1] px-2 py-0.5 font-semibold text-[#15988E]">Không lỗi</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setTranscriptId(c.id)}
                        className="ml-auto font-medium text-admin-600 hover:underline"
                      >
                        Xem transcript
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={<AlertIcon />}
            tone="pending"
            title="Phân tích lỗi ngữ pháp thường gặp"
            badge={`${detail.grammar_checks} lượt chấm`}
          >
            {detail.top_error_types.length === 0 ? (
              <EmptyState text="Chưa có đủ dữ liệu lỗi ngữ pháp trong hội thoại." />
            ) : (
              <ul className="flex flex-col gap-4">
                {detail.top_error_types.map((t) => (
                  <li key={t.error_type}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-admin-ink">{t.error_type}</span>
                      <span className="text-xs text-admin-meta">{t.count} lần ({t.percent}%)</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-admin-fill">
                      <div className="h-full rounded-full bg-[#B47A1B]" style={{ width: `${(t.count / maxErrorTypeCount) * 100}%` }} />
                    </div>
                    {(t.example_original || t.example_corrected) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-admin-fill px-3 py-2 text-xs">
                        <span lang="ja" className="text-[#C94D5C] line-through">{t.example_original}</span>
                        <ArrowRightIcon className="h-3 w-3 shrink-0 text-admin-meta" />
                        <span lang="ja" className="font-medium text-[#15988E]">{t.example_corrected}</span>
                      </div>
                    )}
                    {t.example_why_wrong && <p className="mt-1.5 text-xs italic text-admin-meta">{t.example_why_wrong}</p>}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard icon={<PieChartIcon />} tone="info" title="Nhận định">
            {detail.insight_message ? (
              <p className="text-sm leading-relaxed text-admin-body">{detail.insight_message}</p>
            ) : (
              <EmptyState text="Chưa có đủ dữ liệu để đưa ra nhận định." />
            )}
            {detail.off_topic_rate != null && (
              <p className="mt-3 border-t border-admin-border pt-3 text-xs text-admin-meta">
                Tỷ lệ phản hồi lạc đề: <span className="font-semibold text-admin-ink">{detail.off_topic_rate}%</span>
              </p>
            )}
          </SectionCard>

          <SectionCard icon={<TrashBinIcon />} tone="danger" title="Can thiệp Admin" badge="ADMIN CONVERSATION">
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <TrashBinIcon className="h-4 w-4" /> Đặt lại dữ liệu ngữ pháp cần ôn
              </button>
              <button
                type="button"
                onClick={() => exportConversationHistoryCsv(user, detail)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <DownloadIcon className="h-4 w-4" /> Xuất lịch sử hội thoại (.csv)
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {showClearModal && (
        <ClearConversationGrammarModal
          username={user.username}
          saving={clearing}
          onConfirm={handleClearGrammar}
          onClose={() => setShowClearModal(false)}
        />
      )}
      {transcriptId != null && (
        <ConversationTranscriptModal userId={user.id} conversationId={transcriptId} onClose={() => setTranscriptId(null)} />
      )}
    </div>
  );
}

export function ListeningTab({ user }: TabProps) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<AdminUserListeningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await fetchUserListeningDetail(user.id));
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      setDetail(await clearUserSearchHistory(user.id));
      showToast("Đã xóa lịch sử tra cứu từ điển", "success");
      setShowClearModal(false);
    } catch {
      // reported globally
    } finally {
      setClearing(false);
    }
  };

  if (loading || !detail) return <EmptyState text="Đang tải dữ liệu..." />;

  const maxJlptBucket = Math.max(1, ...detail.jlpt_distribution.map((b) => b.count));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<SearchIcon />}
          tone="neutral"
          label="Tổng lượt tra từ điển"
          value={detail.total_lookups}
          sub={detail.lookups_today > 0 ? `+${detail.lookups_today} lượt hôm nay` : "Chưa tra từ nào hôm nay"}
        />
        <StatCard icon={<DocsIcon />} tone="info" label="Từ vựng riêng biệt đã tra" value={detail.unique_words} />
        <StatCard
          icon={<VideoIcon />}
          tone="pending"
          label="Video đã luyện nghe"
          value={detail.video_sessions_total}
          sub={`${detail.video_sessions_completed} video đã xử lý xong`}
        />
        <StatCard
          icon={<AudioIcon />}
          tone="success"
          label="Thời gian nghe hoàn thành"
          value={formatDurationMinutes(detail.total_listening_minutes)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <SectionCard
            icon={<SearchIcon />}
            title="Lịch sử tra cứu gần đây"
            actions={<span className="text-sm text-admin-meta">Hiển thị {detail.recent_lookups.length}/{detail.total_lookups.toLocaleString("vi-VN")} bản ghi</span>}
          >
            {detail.recent_lookups.length === 0 ? (
              <EmptyState text="Người dùng chưa tra từ điển lần nào." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold uppercase tracking-[1.2px] text-admin-meta">
                      <th className="pb-3 pr-3">Từ vựng &amp; Kanji</th>
                      <th className="pb-3 pr-3">Ý nghĩa vắn tắt</th>
                      <th className="pb-3 pr-3">Cấp độ</th>
                      <th className="pb-3">Thời gian tra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recent_lookups.map((r) => (
                      <tr key={r.id} className="border-t border-admin-border align-top">
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-admin-ink" lang="ja">{r.word}</p>
                          {r.reading && <p className="text-xs text-admin-meta" lang="ja">{r.reading}</p>}
                        </td>
                        <td className="max-w-[220px] truncate py-3 pr-3 text-admin-body" title={r.meaning ?? undefined}>
                          {r.meaning || "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <JlptLevelBadge level={r.jlpt} />
                        </td>
                        <td className="py-3 text-admin-meta">{formatRelativeTime(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={<VideoIcon />}
            title="Video đã dịch &amp; luyện nghe"
            actions={<span className="text-sm text-admin-meta">Hiển thị {detail.videos.length}/{detail.video_sessions_total} video</span>}
          >
            {detail.videos.length === 0 ? (
              <EmptyState text="Người dùng chưa dịch video nào." />
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.videos.map((v) => {
                  const { fill, ink } = TONE_COLORS[v.status_tone as StatTone];
                  return (
                    <li key={v.id} className="flex items-center gap-3 rounded-xl border border-admin-border p-3">
                      {v.thumbnail ? (
                        <img src={v.thumbnail} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-admin-fill text-admin-meta">
                          <VideoIcon className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-admin-ink" lang="ja" title={v.video_title ?? undefined}>
                          {v.video_title || "Video không có tiêu đề"}
                        </p>
                        <p className="mt-0.5 text-xs text-admin-meta">
                          {v.channel_title ? `${v.channel_title} • ` : ""}
                          {v.segment_count} đoạn thoại
                          {v.duration_ms != null ? ` • ${formatDurationMinutes(Math.round(v.duration_ms / 60000))}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{ backgroundColor: fill, color: ink }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ink }} /> {v.status_label}
                        </span>
                        <p className="mt-1 text-xs text-admin-meta">{formatApiDate(v.created_at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard icon={<TrashBinIcon />} tone="danger" title="Can thiệp Admin" badge="ADMIN LISTENING">
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <TrashBinIcon className="h-4 w-4" /> Xóa lịch sử tra cứu
              </button>
              <button
                type="button"
                onClick={() => exportLookupHistoryCsv(user, detail)}
                className="flex items-center justify-center gap-1.5 rounded-[9px] border border-admin-border-input px-4 py-2 text-sm font-medium text-admin-body hover:bg-admin-fill"
              >
                <DownloadIcon className="h-4 w-4" /> Xuất lịch sử tra cứu (.csv)
              </button>
            </div>
          </SectionCard>

          <SectionCard
            icon={<PieChartIcon />}
            title="Phân bố tra cứu theo cấp độ JLPT"
            actions={<span className="text-sm text-admin-meta">{detail.total_lookups.toLocaleString("vi-VN")} lượt</span>}
          >
            {detail.jlpt_distribution.length === 0 ? (
              <EmptyState text="Chưa có dữ liệu tra cứu." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {detail.jlpt_distribution.map((b) => (
                  <li key={b.level}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-admin-body">{b.level}</span>
                      <span className="text-admin-meta">{b.count.toLocaleString("vi-VN")} lượt</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-admin-fill">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(b.count / maxJlptBucket) * 100}%`, backgroundColor: TONE_COLORS[b.tone as StatTone].ink }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            icon={<AlertIcon />}
            tone="pending"
            title="Từ vựng tra cứu nhiều nhất"
            subtitle="Có thể là từ khó nhớ với học viên"
            badge={`${detail.top_words.length} từ tiêu biểu`}
          >
            {detail.top_words.length === 0 ? (
              <EmptyState text="Chưa có từ nào được tra lại nhiều lần." />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {detail.top_words.map((w) => (
                  <li key={w.word} className="flex items-center justify-between gap-3 rounded-xl border border-admin-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-admin-ink" lang="ja" title={w.word}>
                        {w.word}
                        {w.reading && <span className="ml-1 font-normal text-admin-body">({w.reading})</span>}
                      </p>
                      <p className="truncate text-xs text-admin-meta">{w.meaning || "—"}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#FFF3D9] px-2.5 py-1 text-xs font-semibold text-[#B47A1B]">
                      Tra {w.search_count} lần
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      {showClearModal && (
        <ClearSearchHistoryModal
          username={user.username}
          saving={clearing}
          onConfirm={handleClearHistory}
          onClose={() => setShowClearModal(false)}
        />
      )}
    </div>
  );
}
