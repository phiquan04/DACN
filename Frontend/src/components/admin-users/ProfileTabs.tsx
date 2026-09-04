import { ReactNode } from "react";
import { AdminUserDetail, AdminUserLearningStats } from "../../services/adminUserApi";
import { formatApiDate, formatApiDateTime } from "../../utils/datetime";
import { GlobeIcon, PhoneIcon } from "../../icons/custom";
import {
  BoltIcon,
  CalenderIcon,
  ChatIcon,
  DocsIcon,
  GroupIcon,
  MailIcon,
  PencilIcon,
  ShootingStarIcon,
  TaskIcon,
  UserCircleIcon,
  UserIcon,
} from "../../icons";

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

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-admin-border bg-white p-6 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
      <div className="mb-4">
        <h4 className="text-base font-semibold text-admin-ink">{title}</h4>
        {subtitle && <p className="text-sm text-admin-body">{subtitle}</p>}
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
}

export function OverviewTab({ user, stats, loadingStats }: TabProps) {
  const xpSpan = Math.max(1, user.level_xp_ceil - user.level_xp_floor);
  const xpProgress = Math.min(100, Math.max(0, ((user.vocab_xp - user.level_xp_floor) / xpSpan) * 100));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatMini icon={<ShootingStarIcon />} label="Cấp độ" value={`Lv. ${user.level}`} />
        <StatMini icon={<BoltIcon />} label="XP tích lũy" value={user.vocab_xp.toLocaleString("vi-VN")} />
        <StatMini icon={<CalenderIcon />} label="Chuỗi ngày học" value={`${user.streak_days} ngày`} />
        <StatMini
          icon={<TaskIcon />}
          label="Mục tiêu/ngày"
          value={user.daily_vocab_goal != null ? `${user.daily_vocab_goal} từ` : "—"}
        />
      </div>

      <div className="rounded-2xl border border-admin-border bg-white p-5 shadow-[0_4px_16px_rgba(35,67,110,0.05)]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm font-medium text-admin-body">Tiến độ tới cấp Lv. {user.level + 1}</span>
          <span className="text-xs text-admin-meta">
            {user.vocab_xp - user.level_xp_floor}/{xpSpan} XP
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-admin-fill">
          <div className="h-full rounded-full bg-admin-500" style={{ width: `${xpProgress}%` }} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Tài khoản">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoField icon={<TaskIcon />} label="ID" value={`#${user.id}`} />
              <InfoField icon={<UserIcon />} label="Username" value={`@${user.username}`} />
              <InfoField icon={<GroupIcon />} label="Vai trò (role code)" value={user.role} />
              <InfoField icon={<CalenderIcon />} label="Ngày tạo" value={formatApiDateTime(user.created_at)} />
              <InfoField
                icon={<PencilIcon />}
                label="Cập nhật hồ sơ gần nhất"
                value={formatApiDateTime(user.profile_updated_at)}
              />
              <InfoField
                icon={<CalenderIcon />}
                label="Hoạt động gần nhất"
                value={formatApiDateTime(user.last_activity_at)}
              />
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Hoạt động gần đây">
          <ul className="space-y-3">
            <li className="flex gap-2.5">
              <BoltIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#B47A1B]" />
              <div>
                <p className="text-sm text-admin-ink">Đăng nhập gần nhất</p>
                <p className="text-xs text-admin-meta">{formatApiDateTime(user.last_login_at)}</p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <PencilIcon className="mt-0.5 h-4 w-4 shrink-0 text-admin-500" />
              <div>
                <p className="text-sm text-admin-ink">Cập nhật hồ sơ gần nhất</p>
                <p className="text-xs text-admin-meta">{formatApiDateTime(user.profile_updated_at)}</p>
              </div>
            </li>
            <li className="flex gap-2.5">
              <CalenderIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#15988E]" />
              <div>
                <p className="text-sm text-admin-ink">Tạo tài khoản</p>
                <p className="text-xs text-admin-meta">{formatApiDateTime(user.created_at)}</p>
              </div>
            </li>
          </ul>
        </SectionCard>
      </div>

      {!loadingStats && stats && (
        <SectionCard title="Tổng quan học tập" subtitle="Tóm tắt nhanh từ các mục Từ vựng, JLPT, Hội thoại & Nghe/Từ điển">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-admin-fill p-3">
              <p className="text-xs text-admin-meta">Từ đã học</p>
              <p className="mt-1 text-base font-semibold text-admin-ink">{stats.vocabulary.learned}</p>
            </div>
            <div className="rounded-xl bg-admin-fill p-3">
              <p className="text-xs text-admin-meta">Lượt thi JLPT</p>
              <p className="mt-1 text-base font-semibold text-admin-ink">{stats.jlpt.attempts}</p>
            </div>
            <div className="rounded-xl bg-admin-fill p-3">
              <p className="text-xs text-admin-meta">Cuộc hội thoại</p>
              <p className="mt-1 text-base font-semibold text-admin-ink">{stats.conversation.conversations}</p>
            </div>
            <div className="rounded-xl bg-admin-fill p-3">
              <p className="text-xs text-admin-meta">Lượt tra từ điển</p>
              <p className="mt-1 text-base font-semibold text-admin-ink">{stats.listening_dictionary.dictionary_searches}</p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

export function PersonalInfoTab({ user }: TabProps) {
  return (
    <SectionCard title="Thông tin cá nhân" subtitle="Hồ sơ do người dùng khai báo hoặc admin chỉnh sửa">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
        <InfoField icon={<UserIcon />} label="Họ" value={user.first_name ?? ""} />
        <InfoField icon={<UserIcon />} label="Tên" value={user.last_name ?? ""} />
        <InfoField icon={<MailIcon />} label="Email" value={user.email} />
        <InfoField icon={<PhoneIcon />} label="Số điện thoại" value={user.phone ?? ""} />
        <InfoField icon={<CalenderIcon />} label="Ngày sinh" value={formatApiDate(user.date_of_birth)} />
        <InfoField
          icon={<UserCircleIcon />}
          label="Giới tính"
          value={user.gender ? GENDER_LABELS[user.gender] ?? user.gender : ""}
        />
        <InfoField icon={<GlobeIcon />} label="Quốc gia" value={user.country ?? ""} />
        <InfoField icon={<GlobeIcon />} label="Thành phố" value={user.city ?? ""} />
        <InfoField icon={<UserIcon />} label="Username" value={`@${user.username}`} />
      </div>
    </SectionCard>
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
