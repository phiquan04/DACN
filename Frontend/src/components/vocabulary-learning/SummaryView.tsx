import { useEffect, useState } from "react";
import { AlertIcon, BoltIcon, CheckCircleIcon, TimeIcon } from "../../icons";
import Confetti from "./Confetti";
import { BatchOrigin, SessionResult } from "./types";

function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return "<1m";
  return `${minutes}m`;
}

export default function SummaryView({
  result,
  origin,
  streakDays,
  onContinue,
  onBackToDetail,
  onBackToLibrary,
}: {
  result: SessionResult;
  origin: BatchOrigin;
  streakDays: number | null;
  onContinue: () => void;
  onBackToDetail: () => void;
  onBackToLibrary: () => void;
}) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center space-y-8 text-center">
      {showConfetti && <Confetti />}

      <div className="space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
          <CheckCircleIcon className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">Hoàn thành phiên học!</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Hãy tiếp tục duy trì thói quen học mỗi ngày nhé.
          </p>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircleIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{result.learnedCount}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Từ đã thuộc</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-500 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{result.reviewingCount}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Cần ôn lại</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300">
            <TimeIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{formatDuration(result.elapsedSeconds)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Thời gian học</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300">
            <BoltIcon className="h-5 w-5" />
          </div>
          <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-white/90">{streakDays ?? "-"}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Ngày liên tiếp</p>
        </div>
      </div>

      {result.againCount > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {result.againCount} từ bạn đã bấm "Quên hẳn" — hệ thống sẽ cho ôn lại sớm hơn.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {origin.kind === "set" && (
          <button
            type="button"
            onClick={onContinue}
            className="rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:from-brand-600 hover:to-brand-700"
          >
            Học tiếp batch kế
          </button>
        )}
        {origin.kind === "set" && (
          <button
            type="button"
            onClick={onBackToDetail}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
          >
            Về chi tiết bộ
          </button>
        )}
        <button
          type="button"
          onClick={onBackToLibrary}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Về thư viện
        </button>
      </div>
    </div>
  );
}
