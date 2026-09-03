export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export interface Segment {
  start: number;
  end: number;
  japanese: string;
  vietnamese: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  publishedAt: string;
}

export type DisplayMode = "both" | "jp" | "vn";

export function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function toSRTTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
