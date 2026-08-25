import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PredefinedMode from "./components/PredefinedMode";
import VoiceMode from "./components/VoiceMode";

export default function CheckPronunciation() {
  const [activeMode, setActiveMode] = useState<"predefined" | "voice">("predefined");
  const [searchParams] = useSearchParams();

  // Xử lý query param khi vào trang (từ từ điển chuyển sang)
  useEffect(() => {
    const word = searchParams.get("word");
    const reading = searchParams.get("reading");
    const meaning = searchParams.get("meaning");
    if (word) {
      sessionStorage.setItem("practiceWord", JSON.stringify({ word, reading: reading || "", meaning: meaning || "" }));
      setActiveMode("predefined");
    }
  }, [searchParams]);

  return (
    <>
      <PageMeta
        title="Kiểm tra phát âm tiếng Nhật"
        description="Luyện phát âm từ có sẵn hoặc sử dụng giọng nói để nhận diện và sửa phát âm"
      />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-success-400 animate-pulse" />
            AI đang lắng nghe
          </span>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setActiveMode("predefined")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "predefined"
                ? "bg-primary text-on-primary shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Từ có sẵn</div>
            <div className={`text-sm ${activeMode === "predefined" ? "text-on-primary/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Chọn từ trong danh sách
            </div>
          </button>
          <button
            onClick={() => setActiveMode("voice")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "voice"
                ? "bg-primary text-on-primary shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Nhận diện giọng nói</div>
            <div className={`text-sm ${activeMode === "voice" ? "text-on-primary/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Nhập câu và ghi âm để đánh giá
            </div>
          </button>
        </div>

        {activeMode === "predefined" ? <PredefinedMode /> : <VoiceMode />}
      </div>
    </>
  );
}
