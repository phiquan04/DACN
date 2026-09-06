import { useEffect, useState } from "react";
import { HourglassIcon } from "../../icons/custom";
import { ScoreBreakdown, UpcomingExam } from "../../services/jlptApi";
import { formatSittingLabel } from "./dateFormat";

// Flavor text only — no data behind it, just rotates once per mount.
const QUOTES = [
  "Mỗi ngày tích lũy 10 từ vựng và 1 bài đọc, thành công sẽ mỉm cười!",
  "Kiên trì luyện đề mỗi tuần — điểm số sẽ tự nói lên tiến bộ của bạn.",
  "Ôn đều cả 3 kỹ năng, đừng chỉ tập trung vào phần bạn đã giỏi.",
];

function useCountdown(targetIso?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const diff = Math.max(0, new Date(`${targetIso}T00:00:00`).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function TimeSegment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-2.5 py-2">
      <p className="text-2xl font-bold tabular-nums text-white">{String(value).padStart(2, "0")}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

export default function ExamCountdownCard({
  upcoming,
  predicted,
}: {
  upcoming: UpcomingExam | null;
  predicted: ScoreBreakdown | null;
}) {
  const countdown = useCountdown(upcoming?.schedule.exam_date);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  if (!upcoming || !countdown) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center dark:border-gray-600 dark:bg-gray-900">
        <HourglassIcon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
        <p className="text-xs text-gray-400 dark:text-gray-500">Đặt kỳ thi mục tiêu để xem đếm ngược</p>
      </div>
    );
  }

  // How much of the way to the pass threshold your best attempt already
  // covers — the only "progress" number we can honestly derive today.
  const progressPct = predicted
    ? Math.max(4, Math.min(100, Math.round((predicted.total / predicted.pass_total) * 100)))
    : 4;

  return (
    <div className="flex h-full flex-col rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 p-5 text-white shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          <HourglassIcon className="h-3.5 w-3.5" />
          Đếm ngược kỳ thi
        </p>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
          {formatSittingLabel(upcoming.schedule.exam_date)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <TimeSegment value={countdown.days} label="Ngày" />
        <TimeSegment value={countdown.hours} label="Giờ" />
        <TimeSegment value={countdown.minutes} label="Phút" />
        <TimeSegment value={countdown.seconds} label="Giây" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-white/70">
          <span>Tiến độ đạt điểm mục tiêu</span>
          <span className="font-semibold text-white">{progressPct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-amber-400" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <p className="mt-auto pt-4 text-xs italic leading-relaxed text-white/60">&ldquo;{quote}&rdquo;</p>
    </div>
  );
}
