import ProcessingSteps from "../../../components/pronunciation/ProcessingSteps";
import Waveform from "./Waveform";
import { PlayIcon, WarnIcon } from "./icons";

interface AudioAnalysisCardProps {
  onPlayNative: () => void;
  recordedAudioUrl: string | null;
  onPlayRecording: () => void;
  isDeviation: boolean;
  isProcessing: boolean;
  recognizedText?: string;
  className?: string;
}

/** "Phân tích âm thanh" card: native reference waveform + the user's recording, shared by PredefinedMode and VoiceMode. */
export default function AudioAnalysisCard({
  onPlayNative,
  recordedAudioUrl,
  onPlayRecording,
  isDeviation,
  isProcessing,
  recognizedText,
  className = "",
}: AudioAnalysisCardProps) {
  return (
    <div className={`rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <h3 className="mb-5 flex items-center gap-2 text-base font-semibold text-on-surface dark:text-white/90">
        <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h2l2-7 3 14 3-10 2 5h4" />
        </svg>
        Phân tích âm thanh
      </h3>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface-variant dark:text-gray-300">Giọng chuẩn (Native)</span>
          <button
            onClick={onPlayNative}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container hover:opacity-80 transition-opacity"
          >
            <PlayIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center rounded-xl bg-surface-container px-4 py-3 dark:bg-gray-800">
          <Waveform active />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-on-surface-variant dark:text-gray-300">Bản ghi của bạn</span>
          <button
            onClick={onPlayRecording}
            disabled={!recordedAudioUrl}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PlayIcon className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className={`flex items-center rounded-xl px-4 py-3 transition-colors ${isDeviation ? "bg-error-container/50 dark:bg-red-500/10" : "bg-surface-container dark:bg-gray-800"}`}>
          <Waveform active={!!recordedAudioUrl} deviation={isDeviation} />
        </div>
        {isDeviation && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-error dark:text-red-400">
            <WarnIcon />
            Phát hiện lệch ngữ điệu (pitch deviation)
          </p>
        )}
        {!recordedAudioUrl && !isProcessing && (
          <p className="mt-2 text-xs text-on-surface-variant dark:text-gray-500">Chưa có bản ghi — hãy nhấn nút ghi âm ở trên.</p>
        )}
        <ProcessingSteps active={isProcessing} />
        {recognizedText && (
          <p className="mt-2 text-xs text-on-surface-variant dark:text-gray-400">
            Nhận diện được: <span className="font-semibold text-on-surface dark:text-white">「{recognizedText}」</span>
          </p>
        )}
      </div>
    </div>
  );
}
