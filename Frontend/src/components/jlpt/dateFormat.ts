const WEEKDAYS = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export function formatVietnameseDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[d.getDay()]} ${dd}/${mm}/${d.getFullYear()}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// JLPT is held twice a year worldwide, in July and December — a sitting on
// or before September counts as "Đợt 1", the rest as "Đợt 2".
export function formatSittingLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const sitting = d.getMonth() + 1 <= 9 ? 1 : 2;
  return `Đợt ${sitting}/${d.getFullYear()}`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${min}`;
}
