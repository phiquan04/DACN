import { useState } from "react";
import { useAudioRecording } from "../hooks/useAudioRecording";
import AudioAnalysisCard from "./AudioAnalysisCard";
import ScoreCard from "./ScoreCard";
import { BoltIcon, MicIcon, SpeakerIcon, WarnIcon } from "./icons";
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-8 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-secondary dark:text-secondary-fixed-dim">
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
            className="min-w-0 flex-1 rounded-full border border-outline-variant/60 px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
          <button
            onClick={handleGenerateSample}
            disabled={generatingSample || !expectedText.trim()}
            className="flex-shrink-0 rounded-full border border-outline-variant/60 px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:border-outline hover:text-on-surface disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500 transition-colors"
          >
            {generatingSample ? "Đang tạo..." : "📝 Tạo bản mẫu"}
          </button>
        </div>

        {sampleReading !== null && (
          <div className="mt-8 border-t border-outline-variant/60 pt-8 text-center dark:border-gray-700">
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
                isRecording ? "bg-error text-on-error hover:bg-error/90" : "bg-primary text-on-primary hover:bg-brand-600"
              }`}
            >
              <MicIcon className={`w-9 h-9 ${isRecording ? "animate-pulse" : ""}`} />
            </button>
            <p className="mt-4 text-sm font-medium text-on-surface-variant dark:text-gray-400">
              {isRecording ? "Đang ghi âm — nhấn để dừng" : isProcessing ? "Đang xử lý..." : "Nhấn để ghi âm & đánh giá"}
            </p>

            <button
              onClick={handlePlayNative}
              className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-outline-variant/60 px-4 py-1.5 text-xs font-medium text-on-surface-variant hover:border-outline hover:text-on-surface dark:border-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-white transition-colors"
            >
              <SpeakerIcon className="w-3.5 h-3.5" />
              Nghe phát âm chuẩn
            </button>
          </div>
        )}
      </div>

      {sampleReading !== null && (
        <AudioAnalysisCard
          onPlayNative={handlePlayNative}
          recordedAudioUrl={recordedAudioUrl}
          onPlayRecording={recording.playRecording}
          isDeviation={isDeviation}
          isProcessing={isProcessing}
          recognizedText={evaluation?.recognized_text}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ScoreCard
          evaluation={evaluation}
          size="md"
          minHeightClass="min-h-[160px]"
          wrongWordMessage="Không thể chấm điểm do phát âm sai."
          metrics={
            evaluation
              ? [
                  { label: "Phát âm thanh đầu", value: evaluation.accent },
                  { label: "Ngữ điệu", value: evaluation.intonation },
                  { label: "Tốc độ nói", value: evaluation.speed },
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
          {!evaluation && <p className="text-sm text-white/70">Nhận xét sẽ xuất hiện sau khi bạn ghi âm.</p>}
          {evaluation?.wrong_word && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white/10 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-tertiary-fixed">
                  <WarnIcon /> Phát âm sai từ
                </p>
                {evaluation.recognized_text && (
                  <p className="text-sm text-white/90">
                    Nghe được: <span className="font-bold">「{evaluation.recognized_text}」</span>
                  </p>
                )}
              </div>
            </div>
          )}
          {evaluation && !evaluation.wrong_word && (
            <div className="rounded-xl bg-white/10 p-3 text-sm text-white/90">{evaluation.tip}</div>
          )}
          {evaluation && (
            <button
              onClick={recording.tryAgain}
              className="mt-4 w-full rounded-full border border-white/30 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
