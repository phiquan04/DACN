import type { YouTubeVideo } from "../japaneseVideoUtils";

export default function VideoCard({
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
        <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition [@media(hover:none)]:opacity-100">
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
