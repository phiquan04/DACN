import type { Segment, YouTubeVideo } from "./japaneseVideoUtils";

/**
 * Per-tab cache of recently opened videos and their scripts, keyed by YouTube id
 * (the `?v=` in the URL). A reload re-renders the video *and* an already-made
 * script without calling /transcribe again (minutes of Whisper time). Lives in
 * sessionStorage: survives a reload, gone when the tab closes.
 */
const STORAGE_KEY = "videoLearn:sessions";
const MAX_ENTRIES = 10;

export interface CachedVideoSession {
  video: YouTubeVideo;
  segments: Segment[];
}

function readAll(): CachedVideoSession[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CachedVideoSession[]) : [];
  } catch {
    return [];
  }
}

export function readVideoSession(videoId: string): CachedVideoSession | null {
  return readAll().find((s) => s.video.id === videoId) ?? null;
}

export function saveVideoSession(session: CachedVideoSession) {
  const entries = [session, ...readAll().filter((s) => s.video.id !== session.video.id)].slice(0, MAX_ENTRIES);
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // quota exceeded (long scripts) or storage blocked — a reload just shows the video without its script
  }
}
