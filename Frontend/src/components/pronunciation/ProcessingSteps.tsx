import { useEffect, useState } from "react";

const STEPS = [
  "Đang tải bản ghi lên máy chủ",
  "Đang nhận diện giọng nói",
  "Đang phân tích ngữ điệu",
  "Đang chấm điểm",
];

// Thời gian ước lượng cho mỗi bước (ms) — mô phỏng tiến trình vì backend
// trả kết quả đánh giá phát âm trong một lần gọi duy nhất, không có
// cập nhật tiến độ thực từ server.
const STEP_DURATIONS_MS = [500, 1800, 1400, 900];

export default function ProcessingSteps({ active }: { active: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advance = (idx: number) => {
      if (cancelled || idx >= STEPS.length - 1) return;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setStepIndex(idx + 1);
        advance(idx + 1);
      }, STEP_DURATIONS_MS[idx]);
    };
    advance(0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="mt-3 space-y-2" role="status" aria-live="polite">
      {STEPS.map((label, i) => {
        const done = i < stepIndex;
        const current = i === stepIndex;
        return (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                done
                  ? "bg-secondary text-on-secondary"
                  : current
                  ? "border-2 border-primary"
                  : "border border-outline-variant/60"
              }`}
            >
              {done && (
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {current && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
            </span>
            <span
              className={
                done
                  ? "text-on-surface-variant dark:text-gray-500"
                  : current
                  ? "font-medium text-on-surface dark:text-white"
                  : "text-on-surface-variant/60 dark:text-gray-600"
              }
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
