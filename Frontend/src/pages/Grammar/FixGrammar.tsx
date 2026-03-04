import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

export default function FixGrammar() {
  const [sentence, setSentence] = useState("");

  // Mock handlers (chưa xử lý thực tế)
  const handleCheck = () => {
    console.log("Check grammar for:", sentence);
  };

  const handleAlternative = () => {
    console.log("Find alternative expressions");
  };

  return (
    <>
      <PageMeta
        title="Kiểm tra ngữ pháp tiếng Nhật"
        description="Nhập câu tiếng Nhật để kiểm tra ngữ pháp và nhận gợi ý sửa lỗi"
      />
      <div className="space-y-6">
        {/* Input area */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Nhập câu tiếng Nhật cần kiểm tra
          </h2>
          <textarea
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Ví dụ: 私は昨日映画を見ます。"
            rows={5}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:focus:border-brand-400"
          />
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={handleCheck}>
              Kiểm tra ngữ pháp
            </Button>
          </div>
        </div>

        {/* Error explanation area */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Lỗi sai và giải thích
          </h2>
          <div className="space-y-3">
            {/* Mock error item 1 */}
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-500/10">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                Lỗi thì động từ
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Câu của bạn dùng "見ます" (thể lịch sự hiện tại) nhưng ngữ cảnh là quá khứ (hôm qua). Cần dùng thể quá khứ "見ました".
              </p>
            </div>
            {/* Mock error item 2 */}
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-500/10">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                Thiếu trợ từ
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Sau "昨日" nên có trợ từ "は" để đánh dấu chủ đề: "昨日は".
              </p>
            </div>
          </div>
        </div>

        {/* Corrected sentence area */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Câu đã sửa
            </h2>
            <Button size="sm" variant="outline" onClick={handleAlternative}>
              Tìm cách diễn đạt khác
            </Button>
          </div>
          <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-500/10">
            <p className="text-base text-gray-900 dark:text-white">
              私は昨日映画を見ました。
            </p>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Câu đã được sửa lỗi ngữ pháp và thì.
          </p>
        </div>
      </div>
    </>
  );
}