import { AdminUserAccountStatus } from "../../services/adminUserApi";

// Shared badge chips for the admin user list + profile. Radius matches the
// system's small tile radius (6px) — squarer than a pill, but still rounded
// like every other tile/button in the system — kept consistent across all
// three badge kinds so a table row reads as one family.
const BADGE_RADIUS = "rounded-[6px]";

// The 3 states an admin cares about: 'active' (online right now — a
// heartbeat landed within the last few minutes), 'inactive' (not currently
// online — says nothing about whether the account is otherwise fine; most
// accounts sit here most of the time), 'locked' (admin-disabled). Labeled
// "online/offline" rather than "active/inactive" so it doesn't read as a
// durable account-health state. Fill/ink pairs come straight from
// CLAUDE.md's admin status table ("Thành công", "Nháp/trung tính",
// "Lỗi/thất bại").
const ACCOUNT_STATUS_STYLES: Record<AdminUserAccountStatus, { fill: string; ink: string; label: string }> = {
  active: { fill: "#E4F5F1", ink: "#0E7A63", label: "Đang online" },
  inactive: { fill: "#EEF2F7", ink: "#64748B", label: "Ngoại tuyến" },
  locked: { fill: "#FDEBEC", ink: "#C94D5C", label: "Đã khóa" },
};

export function AccountStatusBadge({ status }: { status: AdminUserAccountStatus }) {
  const { fill, ink, label } = ACCOUNT_STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${BADGE_RADIUS} px-2.5 py-1 text-xs font-semibold`}
      style={{ backgroundColor: fill, color: ink }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ink }} /> {label}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  // "Người dùng" reads in the system's admin blue; "Quản trị viên" gets a
  // deep, saturated purple — the two colors need to stay visually distinct
  // since role is the first thing an admin scans a row for.
  return role === "admin" ? (
    <span className={`inline-flex items-center ${BADGE_RADIUS} bg-[#EDE7FA] px-2.5 py-1 text-xs font-semibold text-[#5B21B6]`}>
      Quản trị viên
    </span>
  ) : (
    <span className={`inline-flex items-center ${BADGE_RADIUS} bg-admin-50 px-2.5 py-1 text-xs font-semibold text-admin-600`}>
      Người dùng
    </span>
  );
}

// Each JLPT level gets its own fill/ink pair (reusing tones already in the
// admin palette/status table) so N1-N5 are distinguishable at a glance
// instead of all reading as the same blue chip.
const JLPT_COLORS: Record<string, { fill: string; ink: string }> = {
  N1: { fill: "#E4E8F0", ink: "#142B52" },
  N2: { fill: "#E6F1FC", ink: "#1D4ED8" },
  N3: { fill: "#FFF3D9", ink: "#966317" },
  N4: { fill: "#E4F5F1", ink: "#0E7A63" },
  N5: { fill: "#EDE7FA", ink: "#5B21B6" },
};

// Confirmed via an emailed OTP (see Backend/app/services/email_verification.py).
// Same fill/ink pairs as "Thành công" / "Đang chờ duyệt" in CLAUDE.md's admin
// status table, reused here so the two profile spots that show this status
// (the detail header and the Personal Info tab) render it identically.
export function EmailVerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className={`inline-flex items-center ${BADGE_RADIUS} bg-[#E4F5F1] px-2.5 py-1 text-xs font-semibold text-[#0E7A63]`}>
      Email đã xác minh
    </span>
  ) : (
    <span className={`inline-flex items-center ${BADGE_RADIUS} bg-[#FFF3D9] px-2.5 py-1 text-xs font-semibold text-[#B47A1B]`}>
      Email chưa xác minh
    </span>
  );
}

export function JlptLevelBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-sm text-admin-meta">—</span>;
  const colors = JLPT_COLORS[level] ?? { fill: "#E6F1FC", ink: "#1D4ED8" };
  return (
    <span
      className={`inline-flex items-center ${BADGE_RADIUS} px-2.5 py-1 text-xs font-bold`}
      style={{ backgroundColor: colors.fill, color: colors.ink }}
    >
      {level}
    </span>
  );
}
