import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

// Dữ liệu mẫu cho danh sách từ
const wordList = [
  { word: "ありがとう", reading: "arigatou", meaning: "cảm ơn" },
  { word: "おはよう", reading: "ohayou", meaning: "chào buổi sáng" },
  { word: "こんにちは", reading: "konnichiwa", meaning: "xin chào" },
  { word: "さようなら", reading: "sayounara", meaning: "tạm biệt" },
];

export default function CheckPronunciation() {
  // State giả lập: từ đang được luyện
  const [selectedWord, setSelectedWord] = useState(wordList[0]);

  // Các handler giả lập (chỉ hiển thị thông báo)
  const handlePlayStandard = () => {
    alert("Phát âm chuẩn của từ: " + selectedWord.word);
  };

  const handleStartRecording = () => {
    alert("Bắt đầu ghi âm... (chức năng đang phát triển)");
  };

  const handleTryAgain = () => {
    alert("Thử lại phát âm từ: " + selectedWord.word);
  };

  const handleSelectOther = () => {
    alert("Chuyển sang từ khác");
  };

  return (
    <>
      <PageMeta
        title="Kiểm tra phát âm tiếng Nhật"
        description="Luyện phát âm từ vựng với đánh giá chi tiết"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cột trái: Danh sách từ */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Chọn từ để luyện phát âm
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {wordList.map((item) => (
              <button
                key={item.word}
                onClick={() => setSelectedWord(item)}
                className={`rounded-lg border p-4 text-left transition-all ${
                  selectedWord.word === item.word
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                }`}
              >
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {item.word}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {item.reading}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  {item.meaning}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cột phải: Phát âm và đánh giá */}
        <div className="space-y-6">
          {/* Từ đang luyện */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-md mb-3 font-semibold text-gray-800 dark:text-white/90">
              Phát âm từ: {selectedWord.word}
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={handlePlayStandard}>
                <svg
                  className="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                </svg>
                Nghe phát âm chuẩn
              </Button>
              <Button size="sm" onClick={handleStartRecording}>
                <svg
                  className="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
                Nhấn để ghi âm
              </Button>
            </div>
          </div>

          {/* Kết quả đánh giá */}
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Kết quả đánh giá
            </h3>
            <div className="mb-4 text-center">
              <div className="text-4xl font-bold text-brand-600">85</div>
              <div className="text-sm text-gray-500">/ 100 điểm</div>
              <div className="mt-1 text-sm text-gray-600">Điểm tổng thể</div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Phát âm thanh đầu</span>
                  <span className="font-semibold">90/100</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-2 w-[90%] rounded-full bg-green-500"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Ngữ điệu</span>
                  <span className="font-semibold">75/100</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-2 w-[75%] rounded-full bg-yellow-500"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Tốc độ nói</span>
                  <span className="font-semibold">88/100</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-2 w-[88%] rounded-full bg-blue-500"></div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300">
              💡 Cần chú ý giọng điệu lên xuống tự nhiên hơn.
            </div>

            <div className="mt-6 flex gap-3">
              <Button size="sm" variant="outline" onClick={handleTryAgain}>
                Thử lại
              </Button>
              <Button size="sm" variant="outline" onClick={handleSelectOther}>
                Chọn từ khác
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}