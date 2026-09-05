import { useCallback, useState } from "react";
import { getErrorInfo } from "../../../utils/errors";
import { API_BASE, type YouTubeVideo } from "../japaneseVideoUtils";
import VideoCard from "./VideoCard";

export default function YouTubeSearchPanel({
  onSelect,
}: {
  onSelect: (video: YouTubeVideo) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);

  const defaultQueries = [
    "日本語 JLPT N3 会話",
    "日本語 ニュース",
    "日本語 アニメ 解説",
    "日本語 勉強 vlog",
  ];

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearched(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const res = await fetch(
        `${API_BASE}/api/youtube-search?q=${encodeURIComponent(q)}&lang=ja&maxResults=20`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorMsg = `HTTP ${res.status}`;
        if (contentType?.includes("application/json")) {
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            errorMsg = res.statusText || errorMsg;
          }
        }
        throw new Error(errorMsg);
      }

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error("Server trả về dữ liệu không hợp lệ");
      }

      if (data.error) throw new Error(data.error);
      setResults(data.videos ?? []);
    } catch (err) {
      const { name, message } = getErrorInfo(err);
      if (name === "AbortError") {
        setSearchError("Tìm kiếm quá thời gian. Vui lòng thử lại.");
      } else {
        setSearchError(message ?? "Không thể tìm kiếm");
      }
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query || "日本語");
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm video tiếng Nhật… (vd: JLPT N3, アニメ 解説)"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none transition focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
        >
          {searching ? "…" : "Tìm"}
        </button>
      </form>

      {/* Quick tags */}
      {!searched && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Gợi ý tìm kiếm
          </p>
          <div className="flex flex-wrap gap-2">
            {defaultQueries.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); doSearch(q); }}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-yellow-400 hover:bg-yellow-400/5 hover:text-yellow-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-yellow-400"
              >
                {q}
              </button>
            ))}
          </div>

        </div>
      )}

      {/* Error */}
      {searchError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
          <span>❌</span>
          <p className="text-sm text-red-600 dark:text-red-400">{searchError}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {searching && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800">
              <div className="aspect-video rounded-t-xl bg-gray-200 dark:bg-gray-700" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-full" />
                <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results grid */}
      {!searching && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {results.map((video) => (
            <VideoCard key={video.id} video={video} onSelect={onSelect} />
          ))}
        </div>
      )}

      {/* No results */}
      {!searching && searched && results.length === 0 && !searchError && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl opacity-30">🔍</span>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Không tìm thấy video tiếng Nhật
            <br />
            Thử từ khoá khác
          </p>
        </div>
      )}
    </div>
  );
}
