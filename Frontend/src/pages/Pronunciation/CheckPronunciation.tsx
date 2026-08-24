import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import ProcessingSteps from "../../components/pronunciation/ProcessingSteps";
import { fetchHistoryWords, getStoredUser } from "../../services/api";

// Kiểu dữ liệu cho kết quả đánh giá
interface EvaluationResult {
  overall: number;
  accent: number;
  intonation: number;
  speed: number;
  tip: string;
  recognized_text?: string;
  wrong_word?: boolean;
}

interface HistoryWord {
  word: string;
  reading: string;
  meaning: string;
}

// =====================================================================
// Hàm lấy MIME type thực sự mà trình duyệt hỗ trợ
// =====================================================================
function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

// Màu sắc theo ngưỡng điểm (chỉ là ánh xạ hiển thị, không ảnh hưởng logic chấm điểm)
function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-success-500";
  if (score >= 60) return "bg-warning-500";
  return "bg-error";
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "text-success-500";
  if (score >= 60) return "text-warning-500";
  return "text-error";
}

// =====================================================================
// Icon tĩnh dùng chung
// =====================================================================
const SpeakerIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
);

const MicIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
    <path d="M17 11a5 5 0 01-10 0H5a7 7 0 006 6.92V21h2v-3.08A7 7 0 0019 11h-2z" />
  </svg>
);

const PlayIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const WarnIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const BoltIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const TrophyIcon = ({ className = "w-7 h-7" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 21h8M12 17v4M17 5h2a2 2 0 010 4h-1M7 5H5a2 2 0 000 4h1M7 5h10v3a5 5 0 01-10 0V5z" />
  </svg>
);

// =====================================================================
// Waveform giả lập (chỉ mang tính minh hoạ trực quan)
// =====================================================================
const WAVEFORM_PATTERN = [42, 68, 90, 58, 34, 72, 100, 62, 48, 84, 54, 38, 78, 96, 62, 44, 58, 88, 68, 34, 78, 100, 52, 44, 74, 62, 38, 58];
const EMPTY_PATTERN = new Array(WAVEFORM_PATTERN.length).fill(10);

const Waveform = ({
  active,
  deviation,
}: {
  active: boolean;
  deviation?: boolean;
}) => {
  const pattern = active ? WAVEFORM_PATTERN : EMPTY_PATTERN;
  return (
    <div className="flex flex-1 items-end gap-[3px] h-12">
      {pattern.map((h, i) => {
        const frac = i / (pattern.length - 1);
        const inZone = frac > 0.3 && frac < 0.65;
        let colorClass = "bg-surface-container-high dark:bg-gray-600";
        if (active) {
          colorClass = deviation && inZone ? "bg-error dark:bg-red-500" : "bg-secondary dark:bg-secondary-fixed-dim";
        }
        return <span key={i} className={`w-1 rounded-full transition-colors ${colorClass}`} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
};

// =====================================================================
// Component cho chế độ từ có sẵn — thiết kế theo mẫu "Speech Lab"
// =====================================================================
const PredefinedMode = () => {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wordList, setWordList] = useState<HistoryWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<HistoryWord | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // State cho tìm kiếm theo nghĩa tiếng Việt
  const [vietSearch, setVietSearch] = useState("");
  const [searchResults, setSearchResults] = useState<HistoryWord[]>([]);
  const [searchingMeaning, setSearchingMeaning] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");

  const [currentUser] = useState(() => getStoredUser());
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  // Tải danh sách từ từ history khi mount
  useEffect(() => {
    if (!currentUser) {
      setLoadingWords(false);
      return;
    }
    const loadWords = async () => {
      try {
        const words = await fetchHistoryWords(currentUser.id);
        setWordList(words);
        if (words.length > 0) setSelectedWord(words[0]);
      } catch (err) {
        console.error("Failed to load history words", err);
      } finally {
        setLoadingWords(false);
      }
    };
    loadWords();
  }, [currentUser?.id]);

  // Đọc từ được chọn từ sessionStorage (khi từ trang từ điển chuyển sang)
  useEffect(() => {
    const stored = sessionStorage.getItem("practiceWord");
    if (stored) {
      try {
        const { word, reading, meaning } = JSON.parse(stored);
        const newWord = { word, reading, meaning };
        setWordList(prev => {
          const exists = prev.some(w => w.word === word);
          if (exists) return prev;
          return [newWord, ...prev];
        });
        setSelectedWord(newWord);
        sessionStorage.removeItem("practiceWord");
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const clearRecordedAudio = () => {
    setRecordedAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handlePlayStandard = () => {
    if (!selectedWord) return;
    const utterance = new SpeechSynthesisUtterance(selectedWord.word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const handlePlayRecording = () => {
    if (!recordedAudioUrl) return;
    const audio = new Audio(recordedAudioUrl);
    audio.play();
  };

  const handleStartRecording = async () => {
    if (!selectedWord) return;
    clearRecordedAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        if (audioChunksRef.current.length === 0) {
          alert("Không có dữ liệu ghi âm. Vui lòng thử lại.");
          setIsProcessing(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("expected_text", selectedWord.word);

        setIsProcessing(true);
        try {
          const response = await fetch(
            `${BASE_URL}/api/pronunciation/assess`,
            { method: "POST", body: formData }
          );
          const data = await response.json();
          if (response.ok) {
            setEvaluation(data);
          } else {
            console.error("API error:", data);
            alert(data.error || "Không thể đánh giá phát âm");
          }
        } catch (err) {
          console.error("Lỗi khi gửi:", err);
          alert("Lỗi kết nối. Vui lòng thử lại.");
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error("Lỗi khi bắt đầu ghi âm:", err);
      alert("Không thể truy cập microphone. Vui lòng kiểm tra quyền.");

      // FIX: Reset state khi có lỗi
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const handleStopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleTryAgain = () => {
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
    clearRecordedAudio();
  };

  const handleSelectWord = (item: HistoryWord) => {
    setSelectedWord(item);
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
    clearRecordedAudio();
  };

  // Tìm kiếm từ theo nghĩa tiếng Việt (gọi Gemini)
  const searchByVietnameseMeaning = async () => {
    if (!vietSearch.trim()) return;
    setSearchingMeaning(true);
    try {
      const res = await fetch(`${BASE_URL}/api/dictionary/search-by-meaning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vietnamese: vietSearch }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error(err);
      alert("Không thể tìm từ theo nghĩa.");
    } finally {
      setSearchingMeaning(false);
    }
  };

  const addWordFromSearch = (item: HistoryWord) => {
    setWordList(prev => {
      const exists = prev.some(w => w.word === item.word);
      if (exists) return prev;
      return [item, ...prev];
    });
    setSelectedWord(item);
    setEvaluation(null);
    clearRecordedAudio();
    setSearchResults([]);
    setVietSearch("");
  };

  if (!currentUser) {
    return (
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">Vui lòng đăng nhập để xem danh sách từ đã tra và luyện phát âm.</p>
      </div>
    );
  }

  if (loadingWords) {
    return <div className="text-center py-12 text-on-surface-variant">Đang tải danh sách từ...</div>;
  }

  if (wordList.length === 0 || !selectedWord) {
    return (
      <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-on-surface-variant dark:text-gray-400">
          Chưa có từ nào trong lịch sử tra cứu. Hãy tra từ ở trang Từ điển trước.
        </p>
      </div>
    );
  }

  const isDeviation = !!evaluation && !evaluation.wrong_word && evaluation.intonation < 75;
  const otherWords = wordList.filter(w => w.word !== selectedWord.word);

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
          onClick={!isRecording ? handleStartRecording : handleStopRecording}
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
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 lg:col-span-2">
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
                onClick={handlePlayStandard}
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
                onClick={handlePlayRecording}
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
            {evaluation?.recognized_text && (
              <p className="mt-2 text-xs text-on-surface-variant dark:text-gray-400">
                Nhận diện được: <span className="font-semibold text-on-surface dark:text-white">「{evaluation.recognized_text}」</span>
              </p>
            )}
          </div>
        </div>

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
                value={vietSearch}
                onChange={(e) => setVietSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchByVietnameseMeaning()}
                placeholder="vd: học tập"
                className="min-w-0 flex-1 rounded-full border border-outline-variant/60 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-3 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <button
                onClick={searchByVietnameseMeaning}
                disabled={searchingMeaning || !vietSearch.trim()}
                className="flex-shrink-0 rounded-full bg-primary px-4 text-xs font-medium text-on-primary hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {searchingMeaning ? "..." : "Tìm"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map((item) => (
                  <button
                    key={item.word}
                    onClick={() => addWordFromSearch(item)}
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
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-base font-semibold text-on-surface dark:text-white/90">Điểm tổng quan</h3>
          {evaluation && !evaluation.wrong_word ? (
            <>
              <div className="mb-5 flex justify-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" strokeWidth="8" className="stroke-surface-container-high dark:stroke-gray-700" />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 - (Math.min(evaluation.overall, 100) / 100) * (2 * Math.PI * 40)}
                      className={`${scoreRingColor(evaluation.overall)} stroke-current transition-all duration-500`}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold text-on-surface dark:text-white">{evaluation.overall}</span>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-left">
                <div>
                  <div className="flex justify-between text-sm text-on-surface dark:text-gray-200">
                    <span>Phát âm thanh đầu</span>
                    <span className="font-semibold">{evaluation.accent}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-surface-container-high dark:bg-gray-700">
                    <div className={`h-2 rounded-full ${scoreBarColor(evaluation.accent)}`} style={{ width: `${evaluation.accent}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm text-on-surface dark:text-gray-200">
                    <span>Ngữ điệu (Pitch)</span>
                    <span className={`font-semibold ${evaluation.intonation < 75 ? "text-error dark:text-red-400" : ""}`}>{evaluation.intonation}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-surface-container-high dark:bg-gray-700">
                    <div className={`h-2 rounded-full ${scoreBarColor(evaluation.intonation)}`} style={{ width: `${evaluation.intonation}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm text-on-surface dark:text-gray-200">
                    <span>Tốc độ & nhịp điệu</span>
                    <span className="font-semibold">{evaluation.speed}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-surface-container-high dark:bg-gray-700">
                    <div className={`h-2 rounded-full ${scoreBarColor(evaluation.speed)}`} style={{ width: `${evaluation.speed}%` }}></div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-sm text-on-surface-variant dark:text-gray-400">
              {evaluation?.wrong_word ? "Không thể chấm điểm do phát âm sai từ." : "Ghi âm để xem điểm số của bạn."}
            </div>
          )}
        </div>

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
              onClick={handleTryAgain}
              className="mt-4 rounded-full border border-primary px-6 py-1.5 text-sm font-medium text-primary hover:bg-surface-container dark:text-brand-300 dark:border-brand-400 dark:hover:bg-brand-500/10 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// Component cho chế độ nhận diện giọng nói
// =====================================================================
const VoiceMode = () => {
  const [expectedText, setExpectedText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [sampleReading, setSampleReading] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState("");
  const [generatingSample, setGeneratingSample] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  const clearRecordedAudio = () => {
    setRecordedAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleGenerateSample = async () => {
    if (!expectedText.trim()) {
      alert("Vui lòng nhập câu tiếng Nhật muốn luyện trước.");
      return;
    }
    setGeneratingSample(true);
    setEvaluation(null);
    clearRecordedAudio();
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

  const handlePlayRecording = () => {
    if (!recordedAudioUrl) return;
    const audio = new Audio(recordedAudioUrl);
    audio.play();
  };

  const startRecording = async () => {
    if (!sampleText) {
      alert("Vui lòng tạo bản mẫu trước khi ghi âm.");
      return;
    }
    clearRecordedAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        if (audioChunksRef.current.length === 0) {
          alert("Không có dữ liệu ghi âm.");
          setIsProcessing(false);
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("expected_text", sampleText);

        setIsProcessing(true);
        try {
          const response = await fetch(`${BASE_URL}/api/pronunciation/assess`, {
            method: "POST",
            body: formData,
          });
          const data = await response.json();
          if (response.ok) {
            setEvaluation(data);
          } else {
            console.error("API error:", data);
            alert(data.error || "Không thể đánh giá phát âm");
          }
        } catch (err) {
          console.error("Lỗi gửi:", err);
          alert("Lỗi kết nối. Vui lòng thử lại.");
        } finally {
          setIsProcessing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
    } catch (err) {
      console.error("Lỗi bắt đầu ghi âm:", err);
      alert("Không thể truy cập microphone.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTryAgain = () => {
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
    clearRecordedAudio();
  };

  const isDeviation = !!evaluation && !evaluation.wrong_word && evaluation.intonation < 75;
  const ringCircumference = 2 * Math.PI * 40;
  const ringOffset = evaluation
    ? ringCircumference - (Math.min(evaluation.overall, 100) / 100) * ringCircumference
    : ringCircumference;

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
              onClick={!isRecording ? startRecording : stopRecording}
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
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
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
                onClick={handlePlayNative}
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
                onClick={handlePlayRecording}
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
            {evaluation?.recognized_text && (
              <p className="mt-2 text-xs text-on-surface-variant dark:text-gray-400">
                Nhận diện được: <span className="font-semibold text-on-surface dark:text-white">「{evaluation.recognized_text}」</span>
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-6 text-center shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-4 text-base font-semibold text-on-surface dark:text-white/90">Điểm tổng quan</h3>
          {evaluation && !evaluation.wrong_word ? (
            <>
              <div className="mb-5 flex justify-center">
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" strokeWidth="8" className="stroke-surface-container-high dark:stroke-gray-700" />
                    <circle
                      cx="48" cy="48" r="40" fill="none" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className={`${scoreRingColor(evaluation.overall)} stroke-current transition-all duration-500`}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold text-on-surface dark:text-white">{evaluation.overall}</span>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3 text-left">
                {[
                  ["Phát âm thanh đầu", evaluation.accent],
                  ["Ngữ điệu", evaluation.intonation],
                  ["Tốc độ nói", evaluation.speed],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-sm text-on-surface dark:text-gray-200">
                      <span>{label}</span>
                      <span className="font-semibold">{value}%</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-surface-container-high dark:bg-gray-700">
                      <div className={`h-2 rounded-full ${scoreBarColor(value as number)}`} style={{ width: `${value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-[160px] flex-col items-center justify-center text-sm text-on-surface-variant dark:text-gray-400">
              {evaluation?.wrong_word ? "Không thể chấm điểm do phát âm sai." : "Ghi âm để xem điểm số của bạn."}
            </div>
          )}
        </div>

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
              onClick={handleTryAgain}
              className="mt-4 w-full rounded-full border border-white/30 py-1.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CheckPronunciation() {
  const [activeMode, setActiveMode] = useState<"predefined" | "voice">("predefined");
  const [searchParams] = useSearchParams();

  // Xử lý query param khi vào trang (từ từ điển chuyển sang)
  useEffect(() => {
    const word = searchParams.get("word");
    const reading = searchParams.get("reading");
    const meaning = searchParams.get("meaning");
    if (word) {
      sessionStorage.setItem("practiceWord", JSON.stringify({ word, reading: reading || "", meaning: meaning || "" }));
      setActiveMode("predefined");
    }
  }, [searchParams]);

  return (
    <>
      <PageMeta
        title="Kiểm tra phát âm tiếng Nhật"
        description="Luyện phát âm từ có sẵn hoặc sử dụng giọng nói để nhận diện và sửa phát âm"
      />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex justify-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-on-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-success-400 animate-pulse" />
            AI đang lắng nghe
          </span>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setActiveMode("predefined")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "predefined"
                ? "bg-primary text-on-primary shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Từ có sẵn</div>
            <div className={`text-sm ${activeMode === "predefined" ? "text-on-primary/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Chọn từ trong danh sách
            </div>
          </button>
          <button
            onClick={() => setActiveMode("voice")}
            className={`rounded-2xl px-6 py-4 font-medium text-center transition-all ${
              activeMode === "voice"
                ? "bg-primary text-on-primary shadow-theme-md"
                : "bg-surface-container-lowest border border-outline-variant/60 text-on-surface hover:border-outline-variant dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Nhận diện giọng nói</div>
            <div className={`text-sm ${activeMode === "voice" ? "text-on-primary/80" : "text-on-surface-variant dark:text-gray-400"}`}>
              Nhập câu và ghi âm để đánh giá
            </div>
          </button>
        </div>

        {activeMode === "predefined" ? <PredefinedMode /> : <VoiceMode />}
      </div>
    </>
  );
}
