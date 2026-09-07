// Deterministic, colorful avatar initials — solid color square (rounded like
// every other tile/button in the system, not a circle) with bold white
// initials, so rows are easier to tell apart at a glance. Colors are pulled
// from tokens already in the admin palette, picked by user id so the same
// person always gets the same color across pages. Shared by the learner and
// admin surfaces so a user without an uploaded photo never falls back to a
// generic stock image on either one.
import ZoomableImage from "./ZoomableImage";

const PALETTE = ["#315DCE", "#15988E", "#C94D5C", "#5E6BC4", "#B47A1B", "#4B91D2", "#142B52", "#0E7A63"];

function colorFor(id: number): string {
  return PALETTE[id % PALETTE.length];
}

function initials(name: string, username: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

interface Props {
  id: number;
  name: string;
  username: string;
  avatarUrl?: string | null;
  size?: number;
  // Opt-in only: header dropdown avatars use UserAvatar as a menu trigger,
  // so they must NOT open the zoom modal on click.
  zoomable?: boolean;
}

export default function UserAvatar({ id, name, username, avatarUrl, size = 40, zoomable = false }: Props) {
  // Scale with size so a big profile-header avatar and a small table-row
  // avatar both read as "the same rounded-square shape", not two different
  // radii glued to arbitrary pixel values.
  const radius = Math.round(size * 0.28);

  if (avatarUrl) {
    const style = { width: size, height: size, borderRadius: radius };
    if (zoomable) {
      return <ZoomableImage src={avatarUrl} alt="" style={style} className="shrink-0 object-cover" />;
    }
    return <img src={avatarUrl} alt="" style={style} className="shrink-0 object-cover" />;
  }

  return (
    <span
      style={{ width: size, height: size, backgroundColor: colorFor(id), fontSize: size * 0.36, borderRadius: radius }}
      className="flex shrink-0 items-center justify-center font-bold text-white"
    >
      {initials(name, username)}
    </span>
  );
}
