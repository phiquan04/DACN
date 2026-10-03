import { useCallback, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import { getToken } from "../../../services/authApi";
import { API_BASE, formatTime, toSRTTime, type Segment, type YouTubeVideo } from "../japaneseVideoUtils";

/** Runs a video through /api/transcribe and holds the resulting Japanese/Vietnamese segments, plus copy/export actions over them.
 * `initialSegments` preloads a previously-saved script (from Lịch sử) without hitting /transcribe again. */
export function useTranscription(initialSegments: Segment[] = []) {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">(
    initialSegments.length > 0 ? "done" : "idle"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  // ── Start transcription manually ──
  const startTranscribe = useCallback(async (video: YouTubeVideo | null) => {
    if (!video) return;

    setSegments([]);
    setStatus("processing");
    setErrorMsg("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      const formData = new FormData();
      formData.append("youtube_url", `https://www.youtube.com/watch?v=${video.id}`);
      formData.append("video_id", video.id);
      formData.append("video_title", video.title);
      formData.append("channel_id", video.channelId ?? "");
      formData.append("channel_title", video.channelTitle);
      formData.append("thumbnail", video.thumbnail);

      const token = getToken();
      const res = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorText = `HTTP ${res.status}`;

        if (contentType?.includes("application/json")) {
          try {
            const errData = await res.json();
            errorText = errData.detail || errData.error || errorText;
          } catch {
            errorText = res.statusText || errorText;
          }
        } else {
          try {
            errorText = await res.text();
          } catch {
            errorText = res.statusText || errorText;
          }
        }
        throw new Error(errorText);
      }

      // Parse JSON
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server trả về dữ liệu không hợp lệ. Vui lòng thử lại.");
      }

      if (data.error) throw new Error(data.error);
      if (!data.segments || !Array.isArray(data.segments)) {
        throw new Error("Không tìm thấy dữ liệu transcript");
      }

      setSegments(data.segments);
      setStatus("done");
    } catch (err) {
      const { name, message } = getErrorInfo(err);
      if (name === "AbortError") {
        setErrorMsg("Quá thời gian (>3 phút). Video quá dài hoặc mạng chậm.");
      } else {
        setErrorMsg(message ?? "Không thể kết nối server");
      }
      setStatus("error");
    }
  }, []);

  // ── Copy All ──
  const copyAll = useCallback(() => {
    const text = segments
      .map((s) => `[${formatTime(s.start)}] ${s.japanese}\n         ${s.vietnamese}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => showToast("✓ Đã sao chép vào clipboard"));
  }, [segments, showToast]);

  // ── Export SRT ──
  const exportSRT = useCallback(
    (videoTitle?: string) => {
      const lines = segments
        .map((s, i) => `${i + 1}\n${toSRTTime(s.start)} --> ${toSRTTime(s.end)}\n${s.japanese}\n${s.vietnamese}`)
        .join("\n\n");
      const blob = new Blob([lines], { type: "text/srt" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${videoTitle?.slice(0, 40) || "transcript"}.srt`;
      a.click();
      showToast("✓ Đã xuất file SRT");
    },
    [segments, showToast]
  );

  return { segments, status, errorMsg, toast, reset, startTranscribe, copyAll, exportSRT };
}
