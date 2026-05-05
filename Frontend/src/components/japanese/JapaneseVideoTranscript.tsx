import { useRef, useState, useEffect, useCallback } from "react";

// Load YouTube IFrame API
if (typeof window !== "undefined" && !(window as any).YT) {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";
interface Segment {
  start: number;
  end: number;
  japanese: string;
  vietnamese: string;
}

interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  duration: string;
  publishedAt: string;
}

type DisplayMode = "both" | "jp" | "vn";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toSRTTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.round((secs % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function YouTubeSearchPanel({
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
    } catch (err: any) {
      if (err.name === "AbortError") {
        setSearchError("Tìm kiếm quá thời gian. Vui lòng thử lại.");
      } else {
        setSearchError(err.message ?? "Không thể tìm kiếm");
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
          className="rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
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

function VideoCard({
  video,
  onSelect,
}: {
  video: YouTubeVideo;
  onSelect: (v: YouTubeVideo) => void;
}) {
  return (
    <button
      onClick={() => onSelect(video)}
      className="group flex flex-col rounded-xl border border-transparent bg-gray-50 text-left transition hover:border-yellow-400 hover:shadow-md dark:bg-gray-800/60 dark:hover:border-yellow-400 overflow-hidden"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-black">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
        {/* Duration badge */}
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {video.duration}
          </span>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
          <span className="scale-0 text-3xl transition group-hover:scale-100">▶</span>
        </div>
        {/* Transcript badge */}
        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition">
          <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-bold text-black">
            TRANSCRIPT
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 p-2">
        <p className="line-clamp-2 text-[12px] font-medium leading-snug text-gray-800 dark:text-white/90">
          {video.title}
        </p>
        <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
          {video.channelTitle}
        </p>
      </div>
    </button>
  );
}

// ─── Processing State ────────────────────────────────────────────────────────
function ProcessingState({ videoTitle }: { videoTitle: string }) {
  const steps = [
    { icon: "⬇", label: "Tải audio từ YouTube" },
    { icon: "🎙", label: "Whisper nhận diện tiếng Nhật" },
    { icon: "🌐", label: "Dịch sang tiếng Việt" },
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 3000);
    const t2 = setTimeout(() => setStep(2), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-red-500" />
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 line-clamp-1 max-w-xs">
          {videoTitle}
        </p>
        <p className="text-base font-semibold text-gray-800 dark:text-white/90">
          Đang xử lý video…
        </p>
      </div>
      {/* Steps */}
      <div className="flex flex-col gap-2 min-w-[220px]">
        {steps.map((s, i) => (
          <div key={i} className={`flex items-center gap-3 text-sm transition-all ${i <= step ? "opacity-100" : "opacity-30"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-all
              ${i < step ? "bg-green-100 text-green-600 dark:bg-green-900/40" : i === step ? "bg-yellow-400 text-black animate-pulse" : "bg-gray-100 dark:bg-gray-800"}`}>
              {i < step ? "✓" : s.icon}
            </span>
            <span className={i <= step ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-600"}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mode Toggle ─────────────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }: { mode: DisplayMode; onChange: (m: DisplayMode) => void }) {
  const options: { value: DisplayMode; label: string }[] = [
    { value: "both", label: "🇯🇵 + 🇻🇳" },
    { value: "jp", label: "日本語" },
    { value: "vn", label: "Tiếng Việt" },
  ];
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all
            ${mode === opt.value
              ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SegmentRow({
  seg, index, active, mode, onClick,
}: {
  seg: Segment; index: number; active: boolean; mode: DisplayMode; onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`group relative cursor-pointer rounded-lg border px-3 py-3 transition-all
        ${active
          ? "border-yellow-400 bg-yellow-400/5 dark:bg-yellow-400/10"
          : "border-transparent hover:border-gray-200 hover:bg-gray-50 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
        }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-3/5 w-0.5 -translate-y-1/2 rounded-r bg-yellow-400" />
      )}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] transition-colors
          ${active
            ? "bg-yellow-400 text-black"
            : "bg-gray-100 text-gray-400 group-hover:bg-yellow-400 group-hover:text-black dark:bg-gray-700"
          }`}>
          ▶
        </span>
        <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
          {formatTime(seg.start)} → {formatTime(seg.end)}
        </span>
      </div>
      {mode !== "vn" && (
        <p className="mb-1 font-serif text-[15px] leading-relaxed text-gray-800 dark:text-yellow-50">
          {seg.japanese}
        </p>
      )}
      {mode !== "jp" && (
        <p className="text-[13px] leading-relaxed text-blue-500 dark:text-blue-400">
          {seg.vietnamese}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function JapaneseVideoTranscript() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [mode, setMode] = useState<DisplayMode>("both");
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState("");
  const [playerTime, setPlayerTime] = useState(0);

  // ── Select video (no auto-transcribe) ──
  const handleSelectVideo = useCallback((video: YouTubeVideo) => {
    setSelectedVideo(video);
    setSegments([]);
    setActiveIdx(-1);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  // ── Start transcription manually ──
  const handleStartTranscribe = useCallback(async () => {
    if (!selectedVideo) return;
    
    setSegments([]);
    setActiveIdx(-1);
    setStatus("processing");
    setErrorMsg("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); 
      const formData = new FormData();
        formData.append("youtube_url", `https://www.youtube.com/watch?v=${selectedVideo.id}`);

        const res = await fetch(`${API_BASE}/api/transcribe`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        let errorText = `HTTP ${res.status}`;
        
        if (contentType?.includes("application/json")) {
          try {
            const errData = await res.json();
            errorText = errData.error || errorText;
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
      } catch (parseErr) {
        throw new Error("Server trả về dữ liệu không hợp lệ. Vui lòng thử lại.");
      }

      if (data.error) throw new Error(data.error);
      if (!data.segments || !Array.isArray(data.segments)) {
        throw new Error("Không tìm thấy dữ liệu transcript");
      }
      
      setSegments(data.segments);
      setStatus("done");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setErrorMsg("Quá thời gian (>3 phút). Video quá dài hoặc mạng chậm.");
      } else {
        setErrorMsg(err.message ?? "Không thể kết nối server");
      }
      setStatus("error");
    }
  }, [selectedVideo]);

  // ── Seek via YouTube API ──
  const seekTo = (start: number, idx: number) => {
    setActiveIdx(idx);
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(start, true);
      playerRef.current.playVideo();
    }
  };

  // ── Initialize YouTube Player ──
  useEffect(() => {
    if (!selectedVideo || !iframeRef.current) return;

    const initPlayer = () => {
      if ((window as any).YT?.Player) {
        playerRef.current = new (window as any).YT.Player(iframeRef.current, {
          events: {
            onReady: () => {},
            onStateChange: () => {},
          },
        });
      }
    };

    // Wait for YouTube API to be ready
    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      const checkYT = setInterval(() => {
        if ((window as any).YT?.Player) {
          initPlayer();
          clearInterval(checkYT);
        }
      }, 100);
      return () => clearInterval(checkYT);
    }
  }, [selectedVideo]);

  // ── Poll player time and sync script ──
  useEffect(() => {
    if (!playerRef.current || segments.length === 0) return;

    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        try {
          const ct = playerRef.current.getCurrentTime();
          setPlayerTime(ct);
          const idx = segments.findIndex((s) => ct >= s.start && ct < s.end);
          if (idx >= 0 && idx !== activeIdx) {
            setActiveIdx(idx);
          }
        } catch {}
      }
    }, 300);

    return () => clearInterval(interval);
  }, [segments, activeIdx]);

  // ── Copy All ──
  const copyAll = () => {
    const text = segments
      .map((s) => `[${formatTime(s.start)}] ${s.japanese}\n         ${s.vietnamese}`)
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => showToast("✓ Đã sao chép vào clipboard"));
  };

  // ── Export SRT ──
  const exportSRT = () => {
    const lines = segments
      .map((s, i) => `${i + 1}\n${toSRTTime(s.start)} --> ${toSRTTime(s.end)}\n${s.japanese}\n${s.vietnamese}`)
      .join("\n\n");
    const blob = new Blob([lines], { type: "text/srt" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedVideo?.title?.slice(0, 40) || "transcript"}.srt`;
    a.click();
    showToast("✓ Đã xuất file SRT");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleBack = () => {
    setSelectedVideo(null);
    setSegments([]);
    setStatus("idle");
    setErrorMsg("");
    setActiveIdx(-1);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ── LEFT ── */}
      <div className="flex flex-col gap-4 lg:flex-1">

        {/* YouTube search or video player */}
        {!selectedVideo ? (
          <YouTubeSearchPanel onSelect={handleSelectVideo} />
        ) : (
          <>
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 self-start rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              ← Tìm video khác
            </button>

            {/* YouTube iframe embed */}
            <div className="overflow-hidden rounded-xl bg-black aspect-video w-full">
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${selectedVideo.id}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
                style={{ minHeight: "280px" }}
              />
            </div>

            {/* Processing */}
            {status === "processing" && <ProcessingState videoTitle={selectedVideo.title} />}

            {/* Error */}
            {status === "error" && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
                <span className="text-xl">❌</span>
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Lỗi xử lý</p>
                  <p className="text-xs text-red-500">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Video meta */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-0.5 line-clamp-2">
                {selectedVideo.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 flex-wrap">
                <span className="text-red-500 font-medium">▶ {selectedVideo.channelTitle}</span>
                {segments.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{segments.length} đoạn</span>
                    <span>·</span>
                    <span className="text-yellow-500 font-medium">Whisper (ja)</span>
                  </>
                )}
              </div>
            </div>

            {/* Generate script button */}
            {status === "idle" && segments.length === 0 && (
              <button
                onClick={handleStartTranscribe}
                className="w-full rounded-lg bg-yellow-400 px-4 py-3 text-base font-semibold text-black transition hover:bg-yellow-300"
              >
                🎙 Tạo Script
              </button>
            )}
          </>
        )}
      </div>

      {selectedVideo && (
        <div className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 lg:w-[420px] lg:sticky lg:top-20 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full transition-colors ${
                segments.length > 0 ? "bg-yellow-400 shadow-[0_0_6px_theme(colors.yellow.400)]" : "bg-gray-300 dark:bg-gray-600"
              }`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                Script
              </span>
            </div>
            {segments.length > 0 && (
              <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {segments.length}
              </span>
            )}
          </div>

          {/* Mode toggle */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>

          {/* Segment list */}
          <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: "520px" }}>
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <span className="text-4xl opacity-30">📋</span>
                <p className="text-sm text-gray-400 dark:text-gray-500 leading-relaxed">
                  {status === "processing"
                    ? "Đang tạo transcript…"
                    : status === "error"
                    ? "Không thể tạo transcript"
                    : "Script sẽ xuất hiện ở đây"
                  }
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {segments.map((seg, i) => (
                  <SegmentRow
                    key={i}
                    seg={seg}
                    index={i}
                    active={activeIdx === i}
                    mode={mode}
                    onClick={() => seekTo(seg.start, i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <button
              onClick={copyAll}
              disabled={segments.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              📋 Sao chép
            </button>
            <button
              onClick={exportSRT}
              disabled={segments.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-400 py-2 text-sm font-semibold text-black transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ⬇ Xuất SRT
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 right-8 z-50 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {toast}
        </div>
      )}
    </div>
  );
}