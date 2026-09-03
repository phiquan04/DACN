import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import { useToast } from "../../context/ToastContext";
import { CopyIcon, InfoIcon, TrashBinIcon } from "../../icons";
import { useGrammarCheck } from "./hooks/useGrammarCheck";
import { useGrammarErrorStats } from "./hooks/useGrammarErrorStats";
import DiffText from "./components/DiffText";
import ExplanationList from "./components/ExplanationList";
import ErrorStatsCard from "./components/ErrorStatsCard";
import HistoryTab from "./components/HistoryTab";
import { CheckIcon } from "./components/icons";

type Tab = "check" | "history";

function tabButtonClass(isActive: boolean) {
  return `rounded-2xl px-6 py-4 text-center font-medium transition-all ${
    isActive
      ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-theme-md"
      : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
  }`;
}

export default function FixGrammar() {
  const [activeTab, setActiveTab] = useState<Tab>("check");
  const { showToast } = useToast();
  const { stats: errorStats, loading: statsLoading } = useGrammarErrorStats();
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

  const handleRecheck = (text: string) => {
    setSentence(text);
    setActiveTab("check");
    handleCheck(text);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Đã sao chép", "success");
    } catch {
      showToast("Không thể sao chép", "error");
    }
  };

  return (
    <>
      <PageMeta
        title="Kiểm tra ngữ pháp tiếng Nhật"
        description="Nhập câu tiếng Nhật để kiểm tra ngữ pháp và nhận gợi ý sửa lỗi"
      />
      <div className="space-y-6">
        {/* Tabs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button onClick={() => setActiveTab("check")} className={tabButtonClass(activeTab === "check")}>
            <div className="font-semibold">Kiểm tra ngữ pháp</div>
            <div className={`text-sm ${activeTab === "check" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Nhập câu để kiểm tra và sửa lỗi
            </div>
          </button>
          <button onClick={() => setActiveTab("history")} className={tabButtonClass(activeTab === "history")}>
            <div className="font-semibold">Lịch sử</div>
            <div className={`text-sm ${activeTab === "history" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Các lần kiểm tra trước đây
            </div>
          </button>
        </div>

        {activeTab === "history" ? (
          <HistoryTab active={activeTab === "history"} onRecheck={handleRecheck} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Main column */}
            <div className="space-y-6 lg:col-span-2">
              {/* Input area */}
              <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    Nhập câu tiếng Nhật cần kiểm tra
                  </h2>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">Tối đa 3 câu mỗi lần</span>
                </div>
                <textarea
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  placeholder="Ví dụ: 私は昨日映画を見ます。"
                  rows={5}
                  lang="ja"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white/90 dark:focus:border-brand-400"
                />
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{sentence.length} ký tự</span>
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSentence("")}
                      disabled={!sentence}
                      startIcon={<TrashBinIcon className="h-4 w-4" />}
                    >
                      Xóa
                    </Button>
                    <Button size="sm" onClick={() => handleCheck()} disabled={loading || !sentence.trim()}>
                      {loading ? "Đang kiểm tra..." : "Kiểm tra ngữ pháp"}
                    </Button>
                  </div>
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
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Kết quả sửa lỗi</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      {isChanged && (
                        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                          {result.explanation.length} lỗi
                        </span>
                      )}
                      <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-500/20 dark:text-teal-300">
                        Manabi AI
                      </span>
                    </div>
                  </div>

                  {isChanged ? (
                    <>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        So sánh
                      </p>
                      <div className="rounded-md bg-gray-50 p-4 text-base leading-relaxed dark:bg-gray-800">
                        <DiffText diffs={result.diffs} />
                      </div>
                      <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          <span className="text-teal-600 dark:text-teal-400 font-semibold">Màu xanh</span>: chữ được thêm vào
                        </span>
                        <span>
                          <span className="text-rose-500 line-through">Màu đỏ gạch</span>: chữ bị xóa
                        </span>
                      </div>
                      <div className="mt-4 rounded-md bg-teal-50 p-4 dark:bg-teal-500/10">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-teal-700 dark:text-teal-400">Câu đã sửa:</p>
                          <button
                            onClick={() => copyToClipboard(result.correctedText)}
                            title="Sao chép"
                            className="shrink-0 rounded-md p-1 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20"
                          >
                            <CopyIcon className="h-4 w-4" />
                          </button>
                        </div>
                        <p lang="ja" className="text-base text-gray-900 dark:text-white">{result.correctedText}</p>
                      </div>

                      {result.explanation.length > 0 && (
                        <div className="mt-4">
                          <ExplanationList errors={result.explanation} />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-md bg-emerald-50 p-4 dark:bg-emerald-500/10">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckIcon className="h-4 w-4" />
                        Câu của bạn không có lỗi ngữ pháp!
                      </p>
                      <p lang="ja" className="mt-1 text-base text-gray-900 dark:text-white">{result.correctedText}</p>
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
                          className="flex items-start gap-3 rounded-md bg-teal-50 p-4 dark:bg-teal-500/10"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-200 text-xs font-bold text-teal-700 dark:bg-teal-500/30 dark:text-teal-300">
                            {index + 1}
                          </span>
                          <p lang="ja" className="flex-1 text-base text-gray-900 dark:text-white">{alt}</p>
                          <button
                            onClick={() => copyToClipboard(alt)}
                            title="Sao chép"
                            className="shrink-0 rounded-md p-1 text-teal-600 hover:bg-teal-100 dark:text-teal-400 dark:hover:bg-teal-500/20"
                          >
                            <CopyIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6 lg:col-span-1">
              <ErrorStatsCard stats={errorStats} loading={statsLoading} />

              <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                  <InfoIcon className="h-4 w-4" />
                  Mẹo
                </p>
                <p className="mt-1.5 text-sm text-brand-700/90 dark:text-brand-200/90">
                  Nhập từng câu ngắn, rõ ràng để AI giải thích chi tiết từng lỗi thay vì chỉ tóm tắt.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
