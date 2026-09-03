import { useEffect, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import { API_BASE, type YouTubeVideo } from "../japaneseVideoUtils";

export default function RelatedVideos({
  video,
  onSelect,
}: {
  video: YouTubeVideo;
  onSelect: (v: YouTubeVideo) => void;
}) {
  const [related, setRelated] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          videoId: video.id,
          channelId: video.channelId ?? "",
          title: video.title ?? "",
          maxResults: "10",
        });
        const res = await fetch(`${API_BASE}/api/youtube-related?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRelated(data.videos ?? []);
      } catch (err) {
        if (cancelled) return;
        const { name, message } = getErrorInfo(err);
        if (name !== "AbortError") {
          setError(message ?? "Không thể tải video đề xuất");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [video.id, video.channelId, video.title]);

  if (!loading && !error && related.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        Video đề xuất
      </p>

      {loading && (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex animate-pulse gap-3 rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
              <div className="h-16 w-28 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-700" />
              <div className="flex flex-1 flex-col justify-center gap-1.5">
                <div className="h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-2.5">
          {related.map((v) => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-2 text-left transition hover:border-yellow-400 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-yellow-400"
            >
              <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black">
                <img
                  src={v.thumbnail}
                  alt={v.title}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                {v.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white">
                    {v.duration}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-center gap-0.5 overflow-hidden">
                <p
                  lang="ja"
                  className="line-clamp-2 text-[13px] font-medium leading-snug text-gray-800 dark:text-white/90"
                >
                  {v.title}
                </p>
                <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {v.channelTitle}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
