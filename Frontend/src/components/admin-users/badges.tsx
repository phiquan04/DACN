// Shared badge chips for the admin user list + profile. Radius matches the
// system's small tile radius (6px) — squarer than a pill, but still rounded
// like every other tile/button in the system — kept consistent across all
// three badge kinds so a table row reads as one family.
const BADGE_RADIUS = "rounded-[6px]";

export function AccountStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className={`inline-flex items-center gap-1.5 ${BADGE_RADIUS} bg-[#E4F5F1] px-2.5 py-1 text-xs font-semibold text-[#0E7A63]`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#0E7A63]" /> Hoạt động
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1.5 ${BADGE_RADIUS} bg-[#FDEBEC] px-2.5 py-1 text-xs font-semibold text-[#C94D5C]`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#C94D5C]" /> Đã khóa
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
