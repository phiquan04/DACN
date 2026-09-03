import { API_BASE, type YouTubeVideo } from "../components/japanese/japaneseVideoUtils";
import { authHeaders, request } from "./httpClient";
import { getToken } from "./authApi";

export interface TranscriptSegment {
  start: number;
  end: number;
  japanese: string;
  vietnamese: string;
}

export interface VideoHistoryItem {
  id: number;
  video_id: string;
  video_title: string;
  channel_title: string;
  thumbnail: string;
  segment_count: number;
  has_script: boolean;
  created_at: string;
}

export type VideoHistoryStatus = "all" | "watching" | "completed";

export interface VideoHistoryPage {
  items: VideoHistoryItem[];
  total: number;
  page: number;
  page_size: number;
  total_all: number;
  total_completed: number;
}

export interface VideoHistoryDetail {
  id: number;
  video_id: string;
  video_title: string;
  channel_id: string;
  channel_title: string;
  thumbnail: string;
  segments: TranscriptSegment[];
  created_at: string;
}

export async function fetchVideoHistory(
  page: number,
  status: VideoHistoryStatus = "all"
): Promise<VideoHistoryPage> {
  return request(`/api/transcribe/history?page=${page}&status=${status}`, {
    headers: authHeaders(getToken()),
  });
}

export async function fetchVideoHistoryDetail(id: number): Promise<VideoHistoryDetail> {
  return request(`/api/transcribe/history/${id}`, {
    headers: authHeaders(getToken()),
  });
}

export async function deleteVideoHistoryItem(id: number): Promise<void> {
  await request(`/api/transcribe/history/${id}`, {
    method: "DELETE",
    headers: authHeaders(getToken()),
  });
}

/** Best-effort: records that the user opened this video, even if they never generate a
 * script for it, so it still shows up under Lịch sử. Never throws — a failed write here
 * shouldn't interrupt watching the video, so callers can fire-and-forget it. */
export async function markVideoWatched(video: YouTubeVideo): Promise<void> {
  const token = getToken();
  if (!token) return;
  try {
    const formData = new FormData();
    formData.append("video_id", video.id);
    formData.append("video_title", video.title);
    formData.append("channel_id", video.channelId ?? "");
    formData.append("channel_title", video.channelTitle);
    formData.append("thumbnail", video.thumbnail);
    await fetch(`${API_BASE}/api/transcribe/watch`, {
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // silent — watch-history is a nice-to-have, not worth surfacing a toast for
  }
}
