import { ReactNode } from "react";
import { AdminUserDetail } from "../../services/adminUserApi";
import { formatApiDate, formatApiDateTime } from "../../utils/datetime";
import { LockIcon, UnlockIcon } from "../admin-jlpt/icons";
import { GlobeIcon, KeyIcon, PhoneIcon } from "../../icons/custom";
import {
  BoltIcon,
  CalenderIcon,
  ChevronLeftIcon,
  DocsIcon,
  GroupIcon,
  MailIcon,
  PencilIcon,
  ShootingStarIcon,
  TaskIcon,
  UserCircleIcon,
  UserIcon,
} from "../../icons";

function displayName(u: AdminUserDetail): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || u.username;
}

const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

function InfoField({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </p>
      <p className="mt-0.5 text-sm text-gray-800 dark:text-white/90">{value || "—"}</p>
    </div>
  );
}

function StatMini({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-gray-800 dark:text-white/90">{value}</p>
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
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
  const xpSpan = Math.max(1, user.level_xp_ceil - user.level_xp_floor);
  const xpProgress = Math.min(100, Math.max(0, ((user.vocab_xp - user.level_xp_floor) / xpSpan) * 100));
  const jlptLabel =
    user.current_jlpt_level || user.target_jlpt_level
      ? `${user.current_jlpt_level ?? "—"} → ${user.target_jlpt_level ?? "—"}`
      : "—";

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800 dark:hover:text-white"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Quay lại danh sách
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-20 w-16 shrink-0 rounded-xl border border-gray-200 object-cover dark:border-gray-700" />
          ) : (
            <UserCircleIcon className="h-20 w-16 shrink-0 text-gray-300 dark:text-gray-600" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{displayName(user)}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                  user.role === "admin"
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                {user.role === "admin" ? "Quản trị viên" : "Học viên"}
              </span>
              {user.is_active ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  Đang hoạt động
                </span>
              ) : (
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                  Đã khóa
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              @{user.username} · ID #{user.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRequestEdit}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <PencilIcon className="h-4 w-4" /> Sửa
          </button>
          <button
            type="button"
            onClick={onRequestResetPassword}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <KeyIcon className="h-4 w-4" /> Đặt lại mật khẩu
          </button>
          {user.is_active ? (
            isSelf ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">Không thể tự khóa tài khoản của mình</span>
            ) : (
              <button
                type="button"
                onClick={onRequestLock}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                <LockIcon className="h-4 w-4" /> Khóa tài khoản
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onUnlock}
              disabled={unlocking}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <UnlockIcon className="h-4 w-4" /> {unlocking ? "Đang mở khóa..." : "Mở khóa"}
            </button>
          )}
        </div>
      </div>

      {!user.is_active && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <p className="font-medium">Lý do khóa: {user.locked_reason || "Không có ghi chú"}</p>
          <p className="mt-0.5 text-xs opacity-80">Khóa lúc: {formatApiDateTime(user.locked_at)}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatMini icon={<ShootingStarIcon />} label="Cấp độ" value={`Lv. ${user.level}`} />
        <StatMini icon={<BoltIcon />} label="XP tích lũy" value={String(user.vocab_xp)} />
        <StatMini icon={<CalenderIcon />} label="Chuỗi ngày học" value={`${user.streak_days} ngày`} />
        <StatMini
          icon={<TaskIcon />}
          label="Mục tiêu/ngày"
          value={user.daily_vocab_goal != null ? `${user.daily_vocab_goal} từ` : "—"}
        />
        <StatMini icon={<DocsIcon />} label="JLPT" value={jlptLabel} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tiến độ tới cấp Lv. {user.level + 1}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {user.vocab_xp - user.level_xp_floor}/{xpSpan} XP
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${xpProgress}%` }} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard title="Thông tin cá nhân">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoField icon={<UserIcon />} label="Họ" value={user.first_name ?? ""} />
              <InfoField icon={<UserIcon />} label="Tên" value={user.last_name ?? ""} />
              <InfoField icon={<PhoneIcon />} label="Số điện thoại" value={user.phone ?? ""} />
              <InfoField icon={<CalenderIcon />} label="Ngày sinh" value={formatApiDate(user.date_of_birth)} />
              <InfoField
                icon={<UserCircleIcon />}
                label="Giới tính"
                value={user.gender ? GENDER_LABELS[user.gender] ?? user.gender : ""}
              />
              <InfoField icon={<GlobeIcon />} label="Quốc gia" value={user.country ?? ""} />
              <InfoField icon={<GlobeIcon />} label="Thành phố" value={user.city ?? ""} />
              <InfoField icon={<MailIcon />} label="Email" value={user.email} />
            </div>
          </SectionCard>

          <SectionCard title="Học tập & mục tiêu">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <DocsIcon className="h-3.5 w-3.5" /> Trình độ JLPT hiện tại → mục tiêu
                </p>
                <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white/90">{jlptLabel}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <TaskIcon className="h-3.5 w-3.5" /> Mục tiêu từ vựng mỗi ngày
                </p>
                <p className="mt-1 text-base font-semibold text-gray-800 dark:text-white/90">
                  {user.daily_vocab_goal != null ? `${user.daily_vocab_goal} từ/ngày` : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <CalenderIcon className="h-3.5 w-3.5" /> Hoạt động gần nhất
                </p>
                <p className="mt-1 truncate text-base font-semibold text-gray-800 dark:text-white/90">
                  {formatApiDateTime(user.last_activity_at)}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/60 dark:text-gray-400">
              <ShootingStarIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tổng phút học chưa hiển thị — chờ backend ghi dữ liệu thật vào total_study_minutes.
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Tài khoản">
            <div className="space-y-3">
              <InfoField icon={<TaskIcon />} label="ID" value={`#${user.id}`} />
              <InfoField icon={<UserIcon />} label="Username" value={`@${user.username}`} />
              <InfoField icon={<GroupIcon />} label="Vai trò (role code)" value={user.role} />
              <InfoField icon={<CalenderIcon />} label="Ngày tạo" value={formatApiDateTime(user.created_at)} />
              <InfoField
                icon={<PencilIcon />}
                label="Cập nhật hồ sơ gần nhất"
                value={formatApiDateTime(user.profile_updated_at)}
              />
              <InfoField icon={<KeyIcon />} label="Mật khẩu" value="••••••••" />
            </div>
          </SectionCard>

          <SectionCard title="Hoạt động gần đây">
            <ul className="space-y-3">
              <li className="flex gap-2.5">
                <BoltIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm text-gray-800 dark:text-white/90">Đăng nhập gần nhất</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatApiDateTime(user.last_login_at)}</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <PencilIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm text-gray-800 dark:text-white/90">Cập nhật hồ sơ gần nhất</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatApiDateTime(user.profile_updated_at)}</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <CalenderIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-sm text-gray-800 dark:text-white/90">Tạo tài khoản</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatApiDateTime(user.created_at)}</p>
                </div>
              </li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
