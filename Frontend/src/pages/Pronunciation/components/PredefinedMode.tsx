import { useState } from "react";
import { getStoredUser } from "../../../services/api";
import { usePredefinedWords } from "../hooks/usePredefinedWords";
import { useAudioRecording } from "../hooks/useAudioRecording";
import AiTutorCard from "./AiTutorCard";
import AudioAnalysisCard from "./AudioAnalysisCard";
import ScoreCard from "./ScoreCard";
import { ChevronRightIcon, MicIcon, SpeakerIcon } from "./icons";
import type { HistoryWord } from "../pronunciationUtils";

/** Component cho chế độ từ có sẵn — thiết kế theo mẫu "Speech Lab" */
export default function PredefinedMode() {
  const [currentUser] = useState(() => getStoredUser());
  const words = usePredefinedWords(currentUser);
  const recording = useAudioRecording({
    getExpectedText: () => words.selectedWord?.word ?? "",
    noDataMessage: "Không có dữ liệu ghi âm. Vui lòng thử lại.",
    micErrorMessage: "Không thể truy cập microphone. Vui lòng kiểm tra quyền.",
    resetProcessingOnMicError: true,
  });

  const { selectedWord } = words;

  const handlePlayStandard = () => {
    if (!selectedWord) return;
    const utterance = new SpeechSynthesisUtterance(selectedWord.word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const handleSelectWord = (item: HistoryWord) => {
    words.setSelectedWord(item);
    recording.tryAgain();
  };

  const handleAddWordFromSearch = (item: HistoryWord) => {
    words.addWordFromSearch(item);
    recording.setEvaluation(null);
    recording.clearRecordedAudio();
  };

  if (!currentUser) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">Vui lòng đăng nhập để xem danh sách từ đã tra và luyện phát âm.</p>
      </div>
    );
  }

  if (words.loadingWords) {
    return <div className="text-center py-12 text-on-surface-variant">Đang tải danh sách từ...</div>;
  }

  if (words.wordList.length === 0 || !selectedWord) {
    return (
      <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">
          Chưa có từ nào trong lịch sử tra cứu. Hãy tra từ ở trang Từ điển trước.
        </p>
      </div>
    );
  }

  const { evaluation, isRecording, isProcessing, recordedAudioUrl } = recording;
  const isDeviation = !!evaluation && !evaluation.wrong_word && evaluation.intonation < 75;
  const otherWords = words.wordList.filter((w) => w.word !== selectedWord.word);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      {/* LEFT: recording + audio analysis */}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-secondary dark:text-secondary-fixed-dim">
            <SpeakerIcon className="w-4 h-4" />
            Từ mục tiêu
          </div>
          <div className="text-sm text-on-surface-variant dark:text-gray-400">{selectedWord.reading}</div>
          <div lang="ja" className="my-2 text-5xl font-bold text-on-surface dark:text-white">{selectedWord.word}</div>
          <div className="mb-6 text-base text-on-surface-variant dark:text-gray-400">{selectedWord.meaning}</div>

          <button
            onClick={!isRecording ? recording.startRecording : recording.stopRecording}
            disabled={isProcessing}
            className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full shadow-theme-md transition-colors disabled:opacity-50 ${
              isRecording
                ? "bg-gradient-to-r from-error-500 to-error-600 text-white hover:from-error-600 hover:to-error-700"
                : "bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700"
            }`}
          >
            <MicIcon className={`w-9 h-9 ${isRecording ? "animate-pulse" : ""}`} />
          </button>
          <p className="mt-4 text-sm font-medium text-on-surface-variant dark:text-gray-400">
            {isRecording ? "Đang ghi âm — nhấn để dừng" : isProcessing ? "Đang xử lý..." : "Nhấn để ghi âm"}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handlePlayStandard}
              className="mx-auto flex items-center gap-2 rounded-lg border border-outline-variant/60 px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:border-outline hover:text-on-surface dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white transition-colors"
            >
              <SpeakerIcon className="w-3.5 h-3.5" />
              Nghe phát âm chuẩn
            </button>
            {evaluation && (
              <button
                onClick={recording.tryAgain}
                className="mx-auto rounded-lg border border-primary px-4 py-1.5 text-xs font-medium text-primary hover:bg-surface-container dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10 transition-colors"
              >
                Thử lại
              </button>
            )}
          </div>
        </div>

        <AudioAnalysisCard
          onPlayNative={handlePlayStandard}
          recordedAudioUrl={recordedAudioUrl}
          onPlayRecording={recording.playRecording}
          isDeviation={isDeviation}
          isProcessing={isProcessing}
          recognizedText={evaluation?.recognized_text}
        />
      </div>

      {/* RIGHT: score + AI tutor (empty until a recording is evaluated) + other words to practice */}
      <div className="space-y-6">
        <ScoreCard
          evaluation={evaluation}
          size="lg"
          minHeightClass="min-h-[220px]"
          wrongWordMessage="Không thể chấm điểm do phát âm sai từ."
          metrics={
            evaluation && !evaluation.wrong_word
              ? [
                  { label: "Phát âm thanh đầu", value: evaluation.accent },
                  { label: "Ngữ điệu (Pitch)", value: evaluation.intonation, highlightLow: true },
                  { label: "Tốc độ & nhịp điệu", value: evaluation.speed },
                ]
              : []
          }
        />

        <AiTutorCard evaluation={evaluation} />

        <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-base font-semibold text-on-surface dark:text-white/90">Từ khác để luyện</h3>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {otherWords.length === 0 && (
              <p className="text-sm text-on-surface-variant dark:text-gray-400">Không còn từ khác trong danh sách.</p>
            )}
            {otherWords.map((item) => (
              <button
                key={item.word}
                onClick={() => handleSelectWord(item)}
                disabled={isRecording || isProcessing}
                className="flex w-full items-center justify-between gap-3 rounded-lg border-l-4 border-l-brand-300 bg-brand-50/70 px-4 py-3 text-left transition-colors hover:border-l-teal-500 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-l-brand-500/40 dark:bg-brand-500/5 dark:hover:border-l-teal-400 dark:hover:bg-teal-500/10"
              >
                <div className="min-w-0">
                  <div lang="ja" className="truncate font-semibold text-on-surface dark:text-white">{item.word}</div>
                  {item.reading && (
                    <div lang="ja" className="truncate text-xs text-brand-600 dark:text-brand-300">{item.reading}</div>
                  )}
                  <div className="truncate text-xs text-on-surface-variant dark:text-gray-400">{item.meaning}</div>
                </div>
                <ChevronRightIcon className="w-4 h-4 flex-shrink-0 text-outline dark:text-gray-500" />
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-outline-variant/60 pt-5 dark:border-gray-700">
            <label className="mb-2 block text-xs font-medium text-on-surface-variant dark:text-gray-400">
              Tìm từ theo nghĩa tiếng Việt
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={words.vietSearch}
                onChange={(e) => words.setVietSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && words.searchByVietnameseMeaning()}
                placeholder="vd: học tập"
                className="min-w-0 flex-1 rounded-lg border border-outline-variant/60 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                onClick={words.searchByVietnameseMeaning}
                disabled={words.searchingMeaning || !words.vietSearch.trim()}
                className="flex-shrink-0 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 px-4 text-xs font-medium text-white hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 transition-colors"
              >
                {words.searchingMeaning ? "..." : "Tìm"}
              </button>
            </div>
            {words.searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {words.searchResults.map((item) => (
                  <button
                    key={item.word}
                    onClick={() => handleAddWordFromSearch(item)}
                    className="flex w-full items-center justify-between rounded-xl border border-outline-variant/60 px-3 py-2 text-left text-sm hover:border-primary hover:bg-surface-container dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-gray-800 transition-colors"
                  >
                    <span>
                      <span lang="ja" className="font-semibold text-on-surface dark:text-white">{item.word}</span>
                      <span className="ml-2 text-xs text-on-surface-variant dark:text-gray-400">{item.meaning}</span>
                    </span>
                    <ChevronRightIcon className="w-3.5 h-3.5 flex-shrink-0 text-outline dark:text-gray-500" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
