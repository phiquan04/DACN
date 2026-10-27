import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PredefinedMode from "./components/PredefinedMode";
import VoiceMode from "./components/VoiceMode";
import { useUrlEnum } from "../../hooks/useUrlState";

export default function CheckPronunciation() {
  const [activeMode, setActiveMode] = useUrlEnum<"predefined" | "voice">("mode", ["predefined", "voice"], "predefined");
  const [searchParams] = useSearchParams();

  // Xử lý query param khi vào trang (từ từ điển chuyển sang). Link từ từ điển
  // không có ?mode= nên đã mặc định ở chế độ "Từ có sẵn"; phụ thuộc vào từng
  // giá trị chứ không phải cả searchParams, để đổi ?mode= không chạy lại effect.
  const word = searchParams.get("word");
  const reading = searchParams.get("reading");
  const meaning = searchParams.get("meaning");
  useEffect(() => {
    if (word) {
      sessionStorage.setItem("practiceWord", JSON.stringify({ word, reading: reading || "", meaning: meaning || "" }));
    }
  }, [word, reading, meaning]);

  return (
    <>
      <PageMeta
        title="Kiểm tra phát âm tiếng Nhật"
        description="Luyện phát âm từ có sẵn hoặc sử dụng giọng nói để nhận diện và sửa phát âm"
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setActiveMode("predefined")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "predefined"
                ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Từ có sẵn</div>
            <div className={`text-sm ${activeMode === "predefined" ? "text-white/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Chọn từ trong danh sách
            </div>
          </button>
          <button
            onClick={() => setActiveMode("voice")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "voice"
                ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Nhận diện giọng nói</div>
            <div className={`text-sm ${activeMode === "voice" ? "text-white/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Nhập câu và ghi âm để đánh giá
            </div>
          </button>
        </div>

        {activeMode === "predefined" ? <PredefinedMode /> : <VoiceMode />}
      </div>
    </>
  );
}
