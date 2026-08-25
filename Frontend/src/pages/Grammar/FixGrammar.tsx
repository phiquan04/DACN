import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useGrammarCheck } from "./hooks/useGrammarCheck";
import DiffText from "./components/DiffText";

export default function FixGrammar() {
  const {
    sentence,
    setSentence,
    result,
    loading,
    error,
    alternatives,
    altLoading,
    altError,
    handleCheck,
    handleAlternative,
  } = useGrammarCheck();

  const isChanged = result && result.correctedText !== sentence.replace(/\s/g, "");

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
            <Button size="sm" onClick={handleCheck} disabled={loading || !sentence.trim()}>
              {loading ? "Đang kiểm tra..." : "Kiểm tra ngữ pháp"}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-700 dark:bg-red-500/10">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Kết quả sửa lỗi
            </h2>

            {isChanged ? (
              <>
                <div className="rounded-md bg-gray-50 p-4 text-base leading-relaxed dark:bg-gray-800">
                  <DiffText diffs={result.diffs} />
                </div>
                <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">Màu xanh</span>: chữ được thêm vào
                  </span>
                  <span>
                    <span className="text-red-500 line-through">Màu đỏ gạch</span>: chữ bị xóa
                  </span>
                </div>
                <div className="mt-4 rounded-md bg-green-50 p-4 dark:bg-green-500/10">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">Câu đã sửa:</p>
                  <p className="text-base text-gray-900 dark:text-white">{result.correctedText}</p>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-green-50 p-4 dark:bg-green-500/10">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  ✓ Câu của bạn không có lỗi ngữ pháp!
                </p>
                <p className="mt-1 text-base text-gray-900 dark:text-white">{result.correctedText}</p>
              </div>
            )}

            {/* Alternative button */}
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={handleAlternative} disabled={altLoading}>
                {altLoading ? "Đang tạo..." : "Tìm cách diễn đạt khác"}
              </Button>
            </div>
          </div>
        )}

        {/* Alternative expressions */}
        {(alternatives.length > 0 || altError) && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Cách diễn đạt khác
            </h2>

            {altError && (
              <p className="text-sm text-red-700 dark:text-red-400">{altError}</p>
            )}

            {alternatives.length > 0 && (
              <div className="space-y-3">
                {alternatives.map((alt, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-md bg-blue-50 p-4 dark:bg-blue-500/10"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-700 dark:bg-blue-500/30 dark:text-blue-300">
                      {index + 1}
                    </span>
                    <p className="text-base text-gray-900 dark:text-white">{alt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
