import { useRef, useState } from "react";
import { BASE_URL } from "../../../services/httpClient";
import { EvaluationResult, getSupportedMimeType } from "../../../pages/Pronunciation/pronunciationUtils";
import type { ReviewRating, VocabularyLearningItem } from "../../../services/vocabularyLearningApi";
import BookmarkToggle from "../BookmarkToggle";

export default function PronounceCard({
  item,
  onGrade,
  onToggleBookmark,
}: {
  item: VocabularyLearningItem;
  onGrade: (rating: ReviewRating) => void;
  onToggleBookmark: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const expectedText = item.reading || item.word;

  const startRecording = async () => {
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        form.append("expected_text", expectedText);
        setIsProcessing(true);
        try {
          const res = await fetch(`${BASE_URL}/api/pronunciation/assess`, { method: "POST", body: form });
          const data = await res.json();
          setResult(data);
        } finally {
          setIsProcessing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập trình duyệt.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  return (
    <div className="space-y-4">
      <div className="relative flex h-96 w-full flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <BookmarkToggle active={item.is_bookmarked} onToggle={onToggleBookmark} />
        <span lang="ja" className="text-3xl font-bold text-gray-800 dark:text-white/90">
          {item.word}
        </span>
        {item.reading && (
          <span lang="ja" className="text-base text-gray-500 dark:text-gray-400">
            {item.reading}
          </span>
        )}
        <span className="text-sm text-gray-500 dark:text-gray-400">{item.meaning_vi}</span>

        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
          className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-60 ${
            isRecording
              ? "bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
              : "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
          }`}
        >
          {isRecording ? "Dừng ghi âm" : "Bấm để ghi âm"}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {isProcessing ? "Đang chấm điểm phát âm..." : "Đọc to từ này để AI chấm điểm"}
        </p>

        {result && (
          <div className="w-full rounded-lg bg-gray-50 p-3 text-left dark:bg-gray-800">
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Điểm phát âm: {result.overall}/100</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{result.tip}</p>
          </div>
        )}
      </div>

      {result ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setResult(null)}
            className="rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300"
          >
            Thử lại
          </button>
          <button
            type="button"
            onClick={() => onGrade(result.overall >= 70 ? "easy" : "again")}
            className="rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            Tiếp tục
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onGrade("again")}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-500 dark:text-gray-500"
        >
          Bỏ qua từ này
        </button>
      )}
    </div>
  );
}
