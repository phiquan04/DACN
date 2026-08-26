import { useState } from "react";
import { getStoredUser } from "../../../services/api";
import { usePredefinedWords } from "../hooks/usePredefinedWords";
import { useAudioRecording } from "../hooks/useAudioRecording";
import AudioAnalysisCard from "./AudioAnalysisCard";
import ScoreCard from "./ScoreCard";
import { BoltIcon, ChevronRightIcon, MicIcon, SpeakerIcon, TrophyIcon, WarnIcon } from "./icons";
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
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">Vui lòng đăng nhập để xem danh sách từ đã tra và luyện phát âm.</p>
      </div>
    );
  }

  if (words.loadingWords) {
    return <div className="text-center py-12 text-on-surface-variant">Đang tải danh sách từ...</div>;
  }

  if (words.wordList.length === 0 || !selectedWord) {
    return (
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">
          Chưa có từ nào trong lịch sử tra cứu. Hãy tra từ ở trang Từ điển trước.
        </p>
      </div>
    );
  }

  const { evaluation, isRecording, isProcessing, recordedAudioUrl } = recording;
  const isDeviation = !!evaluation && !evaluation.wrong_word && evaluation.intonation < 75;
  const otherWords = words.wordList.filter((w) => w.word !== selectedWord.word);

  let encouragement = {
    title: "Sẵn sàng chưa?",
    message: "Hãy nhấn nút ghi âm để nhận đánh giá phát âm từ AI.",
  };
  if (evaluation?.wrong_word) {
    encouragement = { title: "Đừng nản lòng!", message: "Nghe kỹ từ mẫu rồi thử phát âm lại nhé." };
  } else if (evaluation) {
    if (evaluation.overall >= 80) {
      encouragement = { title: "Xuất sắc!", message: "Phát âm của bạn rất chuẩn, tiếp tục phát huy nhé." };
    } else if (evaluation.overall >= 60) {
      encouragement = { title: "Khá tốt!", message: "Bạn đang tiến bộ, hãy chú ý thêm phần ngữ điệu." };
    } else {
      encouragement = { title: "Cố gắng thêm nhé!", message: "Luyện tập nhiều hơn sẽ giúp bạn cải thiện nhanh chóng." };
    }
  }

  return (
    <div className="space-y-6">
      {/* Thẻ mục tiêu phát âm */}
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-8 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-secondary dark:text-secondary-fixed-dim">
          <SpeakerIcon className="w-4 h-4" />
          Từ mục tiêu
        </div>
        <div className="text-sm text-on-surface-variant dark:text-gray-400">{selectedWord.reading}</div>
        <div lang="ja" className="my-2 text-5xl font-bold text-on-surface dark:text-white">{selectedWord.word}</div>
        <div className="mb-8 text-base text-on-surface-variant dark:text-gray-400">{selectedWord.meaning}</div>

        <button
          onClick={!isRecording ? recording.startRecording : recording.stopRecording}
          disabled={isProcessing}
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full shadow-theme-md transition-colors disabled:opacity-50 ${
            isRecording ? "bg-error text-on-error hover:bg-error/90" : "bg-primary text-on-primary hover:bg-brand-600"
          }`}
        >
          <MicIcon className={`w-9 h-9 ${isRecording ? "animate-pulse" : ""}`} />
        </button>
        <p className="mt-4 text-sm font-medium text-on-surface-variant dark:text-gray-400">
          {isRecording ? "Đang ghi âm — nhấn để dừng" : isProcessing ? "Đang xử lý..." : "Nhấn để ghi âm"}
        </p>

        <div className="mt-6">
          <button
            onClick={handlePlayStandard}
            className="mx-auto flex items-center gap-2 rounded-full border border-outline-variant/60 px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:border-outline hover:text-on-surface dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white transition-colors"
          >
            <SpeakerIcon className="w-3.5 h-3.5" />
            Nghe phát âm chuẩn
          </button>
        </div>
      </div>

      {/* Phân tích âm thanh + Danh sách từ khác */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AudioAnalysisCard
          className="lg:col-span-2"
          onPlayNative={handlePlayStandard}
          recordedAudioUrl={recordedAudioUrl}
          onPlayRecording={recording.playRecording}
          isDeviation={isDeviation}
          isProcessing={isProcessing}
          recognizedText={evaluation?.recognized_text}
        />

        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
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
                className="flex w-full items-center justify-between rounded-xl border border-outline-variant/60 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-surface-container disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-gray-800"
              >
                <div className="min-w-0">
                  <div lang="ja" className="truncate font-semibold text-on-surface dark:text-white">{item.word}</div>
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
                className="min-w-0 flex-1 rounded-full border border-outline-variant/60 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                onClick={words.searchByVietnameseMeaning}
                disabled={words.searchingMeaning || !words.vietSearch.trim()}
                className="flex-shrink-0 rounded-full bg-primary px-4 text-xs font-medium text-on-primary hover:bg-brand-600 disabled:opacity-50 transition-colors"
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

      {/* Điểm số + AI Tutor + Động viên */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ScoreCard
          evaluation={evaluation}
          size="lg"
          minHeightClass="min-h-[220px]"
          wrongWordMessage="Không thể chấm điểm do phát âm sai từ."
          metrics={
            evaluation
              ? [
                  { label: "Phát âm thanh đầu", value: evaluation.accent },
                  { label: "Ngữ điệu (Pitch)", value: evaluation.intonation, highlightLow: true },
                  { label: "Tốc độ & nhịp điệu", value: evaluation.speed },
                ]
              : []
          }
        />

        <div className="rounded-3xl bg-primary p-6 text-on-primary shadow-theme-md">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
              <BoltIcon />
            </span>
            AI Tutor Feedback
          </h3>

          {!evaluation && (
            <p className="text-sm text-white/70">Nhận xét chi tiết sẽ xuất hiện tại đây sau khi bạn ghi âm.</p>
          )}

          {evaluation?.wrong_word && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-tertiary-fixed">
                  <WarnIcon /> Lỗi phát hiện
                </p>
                <p className="text-sm text-white/90">
                  Hệ thống nghe được:{" "}
                  <span className="font-bold">「{evaluation.recognized_text || "không rõ"}」</span>
                </p>
              </div>
              <div className="rounded-xl bg-secondary-fixed-dim/20 p-3 text-sm text-white/90">
                Hãy nghe lại phát âm chuẩn ở thẻ phía trên và thử lại nhé.
              </div>
            </div>
          )}

          {evaluation && !evaluation.wrong_word && (
            <div className="space-y-3">
              {evaluation.recognized_text !== undefined && (
                <p className="text-sm text-white/70">
                  Whisper nhận diện: <span className="font-semibold text-white">{evaluation.recognized_text || "(không nhận diện được)"}</span>
                </p>
              )}
              <div className="rounded-xl bg-white/10 p-3">
                <p className="mb-1 text-xs font-semibold text-tertiary-fixed">Hướng dẫn cải thiện</p>
                <p className="text-sm text-white/90">{evaluation.tip}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <TrophyIcon />
          </span>
          <h3 className="mt-3 text-lg font-bold text-on-surface dark:text-white/90">{encouragement.title}</h3>
          <p className="mt-1 text-sm text-on-surface-variant dark:text-gray-400">{encouragement.message}</p>
          {evaluation && (
            <button
              onClick={recording.tryAgain}
              className="mt-4 rounded-full border border-primary px-6 py-1.5 text-sm font-medium text-primary hover:bg-surface-container dark:text-brand-300 dark:border-brand-400 dark:hover:bg-brand-500/10 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
