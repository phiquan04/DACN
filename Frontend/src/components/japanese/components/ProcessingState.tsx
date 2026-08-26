import { useEffect, useState } from "react";

export default function ProcessingState({ videoTitle }: { videoTitle: string }) {
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
