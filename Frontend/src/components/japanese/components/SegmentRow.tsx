import { useEffect, useRef } from "react";
import { formatTime, type DisplayMode, type Segment } from "../japaneseVideoUtils";

export default function SegmentRow({
  seg, active, mode, onClick,
}: {
  seg: Segment; active: boolean; mode: DisplayMode; onClick: () => void;
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
