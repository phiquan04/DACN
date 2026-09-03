import { useState } from "react";
import { markVideoWatched } from "../../services/videoLearnApi";
import type { DisplayMode, Segment, YouTubeVideo } from "./japaneseVideoUtils";
import { useYouTubePlayer } from "./hooks/useYouTubePlayer";
import { useTranscription } from "./hooks/useTranscription";
import YouTubeSearchPanel from "./components/YouTubeSearchPanel";
import ProcessingState from "./components/ProcessingState";
import ModeToggle from "./components/ModeToggle";
import SegmentRow from "./components/SegmentRow";
import RelatedVideos from "./components/RelatedVideos";

/** Preloads a previously-saved video + script (from Lịch sử) straight into the player, skipping /transcribe. */
export interface InitialSession {
  video: YouTubeVideo;
  segments: Segment[];
}

export default function JapaneseVideoTranscript({ initialSession }: { initialSession?: InitialSession }) {
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(initialSession?.video ?? null);
  const [mode, setMode] = useState<DisplayMode>("both");

  const transcription = useTranscription(initialSession?.segments ?? []);
  const player = useYouTubePlayer(selectedVideo, transcription.segments);

  // ── Select video (no auto-transcribe) ──
  const handleSelectVideo = (video: YouTubeVideo) => {
    setSelectedVideo(video);
    transcription.reset();
    player.setActiveIdx(-1);
    markVideoWatched(video);
  };

  const handleBack = () => {
    setSelectedVideo(null);
    transcription.reset();
    player.setActiveIdx(-1);
  };

  const handleStartTranscribe = () => {
    player.setActiveIdx(-1);
    transcription.startTranscribe(selectedVideo);
  };

  const { segments, status, errorMsg, toast } = transcription;

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
                ref={player.iframeRef}
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
                className="w-full rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 px-4 py-3 text-base font-semibold text-black transition hover:from-yellow-500 hover:to-yellow-600"
              >
                🎙 Tạo Script
              </button>
            )}

            {/* Related videos */}
            <RelatedVideos video={selectedVideo} onSelect={handleSelectVideo} />
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
                    active={player.activeIdx === i}
                    mode={mode}
                    onClick={() => player.seekTo(seg.start, i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <button
              onClick={transcription.copyAll}
              disabled={segments.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              📋 Sao chép
            </button>
            <button
              onClick={() => transcription.exportSRT(selectedVideo.title)}
              disabled={segments.length === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 to-yellow-500 py-2 text-sm font-semibold text-black transition hover:from-yellow-500 hover:to-yellow-600 disabled:cursor-not-allowed disabled:opacity-40"
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
