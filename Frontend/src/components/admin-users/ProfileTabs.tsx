import { ComponentType, ReactNode, useEffect, useState } from "react";
import { AdminActivityEntry, AdminUserDetail, AdminUserLearningStats, UpdateUserPayload } from "../../services/adminUserApi";
import { useToast } from "../../context/ToastContext";
import { formatApiDate, formatApiDateTime, parseApiDate } from "../../utils/datetime";
import { GlobeIcon, KeyIcon, PhoneIcon } from "../../icons/custom";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import {
  BoltIcon,
  BoxIconLine,
  CalenderIcon,
  ChatIcon,
  DocsIcon,
  MailIcon,
  PencilIcon,
  ShootingStarIcon,
  TaskIcon,
  UserCircleIcon,
  UserIcon,
} from "../../icons";
import StatCard, { StatTone, TONE_COLORS } from "../admin-vocabulary/StatCard";
import { JlptLevelBadge } from "./badges";

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
  onRequestLock?: () => void;
  onUnlock?: () => void;
  unlocking?: boolean;
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
  "auth.login": { icon: BoltIcon, tone: "pending" },
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
  onRequestLock,
  onUnlock,
  unlocking,
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
                <span className="rounded-[6px] bg-[#E4F5F1] px-2 py-0.5 text-[11px] font-semibold text-[#0E7A63]">
                  Đã xác minh
                </span>
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

        <SectionCard
          icon={<BoltIcon />}
          title="Cài đặt học tập & Mục tiêu"
          actions={
            <button type="button" onClick={onRequestEdit} className="text-sm font-medium text-admin-600 hover:text-admin-700">
              Thay đổi lộ trình
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-admin-border bg-admin-fill p-4">
              <p className="text-xs font-medium text-admin-meta">Trình độ hiện tại</p>
              <div className="mt-1.5">
                <JlptLevelBadge level={user.current_jlpt_level} />
              </div>
            </div>
            <div className="rounded-xl border border-admin-border bg-admin-fill p-4">
              <p className="text-xs font-medium text-admin-meta">Mục tiêu sắp tới</p>
              <div className="mt-1.5">
                <JlptLevelBadge level={user.target_jlpt_level} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <InfoField
              icon={<TaskIcon />}
              label="Mục tiêu từ vựng mỗi ngày"
              value={user.daily_vocab_goal != null ? `${user.daily_vocab_goal} từ/ngày` : "Mặc định (20 từ/ngày)"}
            />
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

            <div className="flex items-center justify-between gap-3 rounded-xl bg-admin-fill p-3.5">
              <div>
                <p className="text-xs font-medium text-admin-meta">Trạng thái tài khoản</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-admin-ink">
                  <span className={`h-2 w-2 rounded-full ${user.is_active ? "bg-[#15988E]" : "bg-[#C94D5C]"}`} />
                  {user.is_active ? "Hoạt động" : "Đã khóa"}
                </p>
              </div>
              {user.is_active ? (
                !isSelf && (
                  <button
                    type="button"
                    onClick={onRequestLock}
                    className="shrink-0 rounded-[6px] bg-[#FDEBEC] px-3 py-1.5 text-xs font-semibold text-[#C94D5C] hover:bg-[#F9D8DE]"
                  >
                    Khóa tài khoản
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={onUnlock}
                  disabled={unlocking}
                  className="shrink-0 rounded-[6px] bg-[#E4F5F1] px-3 py-1.5 text-xs font-semibold text-[#15988E] hover:bg-[#D2EEE7] disabled:opacity-50"
                >
                  {unlocking ? "Đang mở khóa..." : "Mở khóa"}
                </button>
              )}
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

export function VocabularyTab({ user, stats, loadingStats }: TabProps) {
  if (loadingStats || !stats) return <EmptyState text="Đang tải dữ liệu..." />;
  const v = stats.vocabulary;
  const total = v.learned + v.reviewing + v.new;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatMini icon={<DocsIcon />} label="Từ đã thuộc" value={String(v.learned)} />
        <StatMini icon={<TaskIcon />} label="Đang ôn tập" value={String(v.reviewing)} />
        <StatMini icon={<BoltIcon />} label="Từ mới" value={String(v.new)} />
        <StatMini icon={<ShootingStarIcon />} label="Lượt ôn tập" value={String(v.total_reviews)} />
      </div>

      <SectionCard title="Tỉ lệ tiến độ từ vựng" subtitle={`Tổng ${total} từ đã tương tác`}>
        {total === 0 ? (
          <EmptyState text="Người dùng chưa học từ vựng nào." />
        ) : (
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-admin-fill">
            <div className="h-full bg-[#15988E]" style={{ width: `${(v.learned / total) * 100}%` }} />
            <div className="h-full bg-[#B47A1B]" style={{ width: `${(v.reviewing / total) * 100}%` }} />
            <div className="h-full bg-admin-200" style={{ width: `${(v.new / total) * 100}%` }} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-admin-body">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#15988E]" /> Đã thuộc</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B47A1B]" /> Đang ôn tập</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-admin-200" /> Từ mới</span>
        </div>
      </SectionCard>

      <SectionCard title="Mục tiêu học tập">
        <InfoField
          icon={<TaskIcon />}
          label="Mục tiêu từ vựng mỗi ngày"
          value={user.daily_vocab_goal != null ? `${user.daily_vocab_goal} từ/ngày` : "—"}
        />
      </SectionCard>
    </div>
  );
}

export function JlptTab({ user, stats, loadingStats }: TabProps) {
  if (loadingStats || !stats) return <EmptyState text="Đang tải dữ liệu..." />;
  const j = stats.jlpt;

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Trình độ JLPT">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#E6F1FC] px-3 py-1.5 text-sm font-semibold text-[#4B91D2]">
            Hiện tại: {user.current_jlpt_level ?? "—"}
          </span>
          <span className="text-admin-meta">→</span>
          <span className="rounded-full bg-admin-50 px-3 py-1.5 text-sm font-semibold text-admin-600">
            Mục tiêu: {user.target_jlpt_level ?? "—"}
          </span>
        </div>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatMini icon={<DocsIcon />} label="Lượt thi" value={String(j.attempts)} />
        <StatMini icon={<TaskIcon />} label="Đã hoàn thành" value={String(j.completed)} />
        <StatMini icon={<ShootingStarIcon />} label="Điểm trung bình" value={j.average_score != null ? j.average_score.toString() : "—"} />
        <StatMini icon={<BoltIcon />} label="Điểm cao nhất" value={j.best_score != null ? String(j.best_score) : "—"} />
      </div>

      <SectionCard title="Lần thi gần nhất">
        <InfoField icon={<CalenderIcon />} label="Thời gian nộp bài" value={formatApiDateTime(j.last_attempt_at)} />
      </SectionCard>
    </div>
  );
}

export function ConversationTab({ stats, loadingStats }: TabProps) {
  if (loadingStats || !stats) return <EmptyState text="Đang tải dữ liệu..." />;
  const c = stats.conversation;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatMini icon={<ChatIcon />} label="Cuộc hội thoại" value={String(c.conversations)} />
        <StatMini icon={<TaskIcon />} label="Tin nhắn đã gửi" value={String(c.messages_sent)} />
        <StatMini icon={<DocsIcon />} label="Lượt chấm ngữ pháp" value={String(c.grammar_checks)} />
        <StatMini icon={<BoltIcon />} label="Lỗi TB / lượt chấm" value={c.average_errors != null ? c.average_errors.toString() : "—"} />
      </div>
      {c.conversations === 0 && <EmptyState text="Người dùng chưa luyện hội thoại AI lần nào." />}
    </div>
  );
}

export function ListeningTab({ stats, loadingStats }: TabProps) {
  if (loadingStats || !stats) return <EmptyState text="Đang tải dữ liệu..." />;
  const l = stats.listening_dictionary;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatMini icon={<DocsIcon />} label="Video đã dịch" value={String(l.transcription_sessions)} />
        <StatMini icon={<TaskIcon />} label="Đã xử lý xong" value={String(l.transcription_completed)} />
        <StatMini icon={<MailIcon />} label="Lượt tra từ điển" value={String(l.dictionary_searches)} />
      </div>
      {l.transcription_sessions === 0 && l.dictionary_searches === 0 && (
        <EmptyState text="Người dùng chưa dùng tính năng nghe hoặc tra từ điển." />
      )}
    </div>
  );
}
