// Backend timestamps are naive UTC (Python `datetime.utcnow()` on a
// `DateTime` column with no timezone), so FastAPI serializes them WITHOUT a
// 'Z'/offset suffix — e.g. "2026-08-31T08:04:27". A JS Date parsed from a
// date-time string with no timezone marker is treated as LOCAL time per the
// ECMA-262 spec, so `new Date(iso)` silently skips the UTC->local
// conversion and every timestamp from the API renders several hours off
// (the viewer's UTC offset). Always go through parseApiDate/formatApi* for
// a value that came from the backend instead of calling `new Date()` on it
// directly.
const HAS_TIMEZONE = /Z$|[+-]\d{2}:?\d{2}$/;

export function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(HAS_TIMEZONE.test(iso) ? iso : `${iso}Z`);
}

export function formatApiDateTime(iso: string | null | undefined, fallback = "—"): string {
  const d = parseApiDate(iso);
  return d ? d.toLocaleString("vi-VN") : fallback;
}

export function formatApiDate(iso: string | null | undefined, fallback = "—"): string {
  const d = parseApiDate(iso);
  return d ? d.toLocaleDateString("vi-VN") : fallback;
}
