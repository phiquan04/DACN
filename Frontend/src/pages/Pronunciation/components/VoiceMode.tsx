import { useState } from "react";
import { useAudioRecording } from "../hooks/useAudioRecording";
import AiTutorCard from "./AiTutorCard";
import AudioAnalysisCard from "./AudioAnalysisCard";
import ScoreCard from "./ScoreCard";
import { MicIcon, SpeakerIcon } from "./icons";
import { BASE_URL } from "../pronunciationUtils";

/** Component cho chế độ nhận diện giọng nói */
export default function VoiceMode() {
  const [expectedText, setExpectedText] = useState("");
  const [sampleReading, setSampleReading] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState("");
  const [generatingSample, setGeneratingSample] = useState(false);

  const recording = useAudioRecording({
    getExpectedText: () => sampleText,
    notReadyMessage: "Vui lòng tạo bản mẫu trước khi ghi âm.",
    noDataMessage: "Không có dữ liệu ghi âm.",
    micErrorMessage: "Không thể truy cập microphone.",
  });

  const handleGenerateSample = async () => {
    if (!expectedText.trim()) {
      alert("Vui lòng nhập câu tiếng Nhật muốn luyện trước.");
      return;
    }
    setGeneratingSample(true);
    recording.setEvaluation(null);
    recording.clearRecordedAudio();
    try {
      const res = await fetch(`${BASE_URL}/api/dictionary/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: expectedText }),
      });
      const data = await res.json();
      setSampleText(expectedText);
      setSampleReading(data.reading || "");
    } catch (err) {
      console.error("Lỗi tạo bản mẫu:", err);
      alert("Không thể tạo bản mẫu. Vui lòng thử lại.");
    } finally {
      setGeneratingSample(false);
    }
  };

  const handlePlayNative = () => {
    if (!sampleText) return;
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const { evaluation, isRecording, isProcessing, recordedAudioUrl } = recording;
  const isDeviation = !!evaluation && !evaluation.wrong_word && evaluation.intonation < 75;

  const inputCard = (
    <div className="rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-secondary dark:text-secondary-fixed-dim">
        <SpeakerIcon className="w-4 h-4" />
        Câu tự do
      </div>
      <label className="mb-2 block text-sm font-medium text-on-surface dark:text-gray-300">
        Nhập câu tiếng Nhật muốn luyện
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={expectedText}
          onChange={(e) => setExpectedText(e.target.value)}
          placeholder="Ví dụ: こんにちは、お元気ですか"
          lang="ja"
          className="min-w-0 flex-1 rounded-lg border border-outline-variant/60 px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <button
          onClick={handleGenerateSample}
          disabled={generatingSample || !expectedText.trim()}
          className="flex-shrink-0 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:bg-brand-200 disabled:text-white/80"
        >
          {generatingSample ? "Đang tạo..." : "Tạo bản mẫu"}
        </button>
      </div>

      {sampleReading !== null && (
        <div className="mt-6 border-t border-outline-variant/60 pt-6 text-center dark:border-gray-700">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-secondary dark:text-secondary-fixed-dim">
            <SpeakerIcon className="w-4 h-4" />
            Bản mẫu
          </div>
          {sampleReading && <div className="text-sm text-on-surface-variant dark:text-gray-400">{sampleReading}</div>}
          <div lang="ja" className="my-2 text-3xl font-bold text-on-surface dark:text-white">{sampleText}</div>

          <button
            onClick={!isRecording ? recording.startRecording : recording.stopRecording}
            disabled={isProcessing}
            className={`mx-auto mt-4 flex h-24 w-24 items-center justify-center rounded-full shadow-theme-md transition-colors disabled:opacity-50 ${
              isRecording
                ? "bg-gradient-to-r from-error-500 to-error-600 text-white hover:from-error-600 hover:to-error-700"
                : "bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700"
            }`}
          >
            <MicIcon className={`w-9 h-9 ${isRecording ? "animate-pulse" : ""}`} />
          </button>
          <p className="mt-4 text-sm font-medium text-on-surface-variant dark:text-gray-400">
            {isRecording ? "Đang ghi âm — nhấn để dừng" : isProcessing ? "Đang xử lý..." : "Nhấn để ghi âm & đánh giá"}
          </p>

          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handlePlayNative}
              className="flex items-center gap-2 rounded-lg border border-outline-variant/60 px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:border-outline hover:text-on-surface dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white transition-colors"
            >
              <SpeakerIcon className="w-3.5 h-3.5" />
              Nghe phát âm chuẩn
            </button>
            {evaluation && (
              <button
                onClick={recording.tryAgain}
                className="rounded-lg border border-primary px-4 py-1.5 text-xs font-medium text-primary hover:bg-surface-container dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-500/10 transition-colors"
              >
                Thử lại
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (sampleReading === null) {
    return <div className="space-y-6">{inputCard}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      {/* LEFT: recording + audio analysis */}
      <div className="space-y-6 lg:col-span-2">
        {inputCard}
        <AudioAnalysisCard
          onPlayNative={handlePlayNative}
          recordedAudioUrl={recordedAudioUrl}
          onPlayRecording={recording.playRecording}
          isDeviation={isDeviation}
          isProcessing={isProcessing}
          recognizedText={evaluation?.recognized_text}
        />
      </div>

      {/* RIGHT: score + AI tutor */}
      <div className="space-y-6">
        <ScoreCard
          evaluation={evaluation}
          size="md"
          minHeightClass="min-h-[160px]"
          wrongWordMessage="Không thể chấm điểm do phát âm sai."
          metrics={
            evaluation && !evaluation.wrong_word
              ? [
                  { label: "Phát âm thanh đầu", value: evaluation.accent },
                  { label: "Ngữ điệu", value: evaluation.intonation },
                  { label: "Tốc độ nói", value: evaluation.speed },
                ]
              : []
          }
        />

        <AiTutorCard evaluation={evaluation} />
      </div>
    </div>
  );
}
