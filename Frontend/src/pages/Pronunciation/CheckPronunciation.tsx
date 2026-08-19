import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import InputField from "../../components/form/input/InputField";
import { getStoredUser, fetchHistoryWords } from "../../services/api";

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

// Component hiển thị kết quả đánh giá (dùng chung)
const EvaluationDisplay = ({
  evaluation,
  onTryAgain,
}: {
  evaluation: EvaluationResult | null;
  onTryAgain: () => void;
}) => {
  if (!evaluation) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-10 h-10 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <svg className="w-3 h-3 text-brand-400 absolute top-0 left-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l.75 2.25h2.25l-1.8 1.35.75 2.25L12 6.6l-1.2.9.75-2.25-1.8-1.35h2.25L12 2z" /></svg>
              <svg className="w-3 h-3 text-brand-400 absolute top-1 right-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l.75 2.25h2.25l-1.8 1.35.75 2.25L12 6.6l-1.2.9.75-2.25-1.8-1.35h2.25L12 2z" /></svg>
              <svg className="w-2 h-2 text-brand-300 absolute bottom-2 left-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l.75 2.25h2.25l-1.8 1.35.75 2.25L12 6.6l-1.2.9.75-2.25-1.8-1.35h2.25L12 2z" /></svg>
              <svg className="w-2 h-2 text-brand-300 absolute bottom-1 right-2" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l.75 2.25h2.25l-1.8 1.35.75 2.25L12 6.6l-1.2.9.75-2.25-1.8-1.35h2.25L12 2z" /></svg>
            </div>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">Chưa có đánh giá nào.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Hãy nhấn nút ghi âm để bắt đầu.</p>
          <button
            onClick={onTryAgain}
            className="mt-6 px-8 py-2 border border-brand-500 text-brand-500 font-medium rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        Kết quả đánh giá
      </h3>

      {evaluation.wrong_word && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">❌</span>
            <p className="font-bold text-red-700 dark:text-red-400">Phát âm sai từ!</p>
          </div>
          {evaluation.recognized_text && (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-red-600 dark:text-red-400">
                Hệ thống nghe được:{" "}
                <span className="font-bold text-red-700 dark:text-red-300">
                  「{evaluation.recognized_text}」
                </span>
              </p>
            </div>
          )}
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            Hãy nghe lại phát âm chuẩn và thử lại.
          </p>
        </div>
      )}

      {!evaluation.wrong_word && evaluation.recognized_text !== undefined && (
        <div className="mb-4 rounded-md bg-blue-50 p-3 dark:bg-blue-500/10">
          <p className="text-xs text-blue-600 dark:text-blue-400">Whisper nhận diện:</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {evaluation.recognized_text || "(không nhận diện được)"}
          </p>
        </div>
      )}

      {!evaluation.wrong_word ? (
        <>
          <div className="mb-4 text-center">
            <div className="text-4xl font-bold text-brand-600">{evaluation.overall}</div>
            <div className="text-sm text-gray-500">/ 100 điểm</div>
            <div className="mt-1 text-sm text-gray-600">Điểm tổng thể</div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm">
                <span>Phát âm thanh đầu</span>
                <span className="font-semibold">{evaluation.accent}/100</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-2 rounded-full bg-green-500" style={{ width: `${evaluation.accent}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Ngữ điệu</span>
                <span className="font-semibold">{evaluation.intonation}/100</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-2 rounded-full bg-yellow-500" style={{ width: `${evaluation.intonation}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Tốc độ nói</span>
                <span className="font-semibold">{evaluation.speed}/100</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-2 rounded-full bg-blue-500" style={{ width: `${evaluation.speed}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300">
            💡 {evaluation.tip}
          </div>
        </>
      ) : (
        <div className="mt-2 rounded-md bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
          💡 Hãy nghe kỹ từ mẫu trước khi phát âm lại.
        </div>
      )}
    </div>
  );
};

// =====================================================================
// Component cho chế độ từ có sẵn (giữ nguyên)
// =====================================================================
const PredefinedMode = () => {
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wordList, setWordList] = useState<HistoryWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<HistoryWord | null>(null);
  const [loadingWords, setLoadingWords] = useState(true);

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

  const handlePlayStandard = () => {
    if (!selectedWord) return;
    const utterance = new SpeechSynthesisUtterance(selectedWord.word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const handleStartRecording = async () => {
    if (!selectedWord) return;
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
  };

  const handleSelectWord = (item: HistoryWord) => {
    setSelectedWord(item);
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
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
    setSearchResults([]);
    setVietSearch("");
  };

  if (!currentUser) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">Vui lòng đăng nhập để xem danh sách từ đã tra và luyện phát âm.</p>
      </div>
    );
  }

  if (loadingWords) {
    return <div className="text-center py-12">Đang tải danh sách từ...</div>;
  }

  if (wordList.length === 0 && !loadingWords) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">
          Chưa có từ nào trong lịch sử tra cứu. Hãy tra từ ở trang Từ điển trước.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Danh sách từ - có cuộn */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-5 text-base font-semibold text-gray-800 dark:text-white/90 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" /></svg>
          Chọn từ để luyện
        </h2>
        <div className="max-h-64 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {wordList.map((item) => (
              <button
                key={item.word}
                onClick={() => handleSelectWord(item)}
                disabled={isRecording || isProcessing}
                className={`rounded-lg border p-4 transition-all ${
                  selectedWord?.word === item.word
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                } ${isRecording || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="text-lg font-bold text-gray-900 dark:text-white mb-1">{item.word}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.reading}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">{item.meaning}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Điều khiển phát âm */}
      {selectedWord && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="mb-8 text-base font-semibold text-gray-700 dark:text-gray-300">
            Đang luyện
          </h3>
          
          <div className="flex items-center justify-center gap-8 mb-8">
            <button
              onClick={handlePlayStandard}
              disabled={isRecording || isProcessing}
              className="p-4 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>

            <div className="text-center">
              <div className="text-4xl font-bold text-brand-600 dark:text-primary-fixed-dim mb-2">{selectedWord.word}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{selectedWord.reading}</div>
              <div className="text-sm text-gray-500 dark:text-gray-500">{selectedWord.meaning}</div>
            </div>

            <button
              onClick={!isRecording ? handleStartRecording : handleStopRecording}
              disabled={isProcessing}
              className={`p-4 rounded-full transition-colors disabled:opacity-50 ${
                isRecording
                  ? "bg-red-100 hover:bg-red-200 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-400"
              }`}
            >
              <svg className={`w-6 h-6 ${isRecording ? "animate-pulse" : ""}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17.3 11c.4-1.45.7-2.85.7-4.3 0-.35-.03-.69-.07-1.02.21.57.35 1.18.35 1.82v2c0 2.64-1.35 4.95-3.38 6.38.4.53.88.88.88.88.56 0 4.41-3.58 4.41-3.58v-.3c0-.35-.07-.68-.16-1 .12.81.37 1.59.74 2.32l2.04.01c-.02-.42-.3-4.01-1.57-5.9zM12 16c2.21 0 4-1.79 4-4h2c0 3.31-2.69 6-6 6s-6-2.69-6-6h2c0 2.21 1.79 4 4 4z" />
              </svg>
            </button>
          </div>

          {evaluation?.recognized_text && (
            <div className="mb-6 rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10 text-center">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Nhận diện được:</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{evaluation.recognized_text}</p>
            </div>
          )}

          {isProcessing && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
              Đang xử lý...
            </div>
          )}
        </div>
      )}

      <EvaluationDisplay evaluation={evaluation} onTryAgain={handleTryAgain} />
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
  const [webSpeechText, setWebSpeechText] = useState(""); // chỉ để hiển thị
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

  // Khởi tạo Web Speech API (chỉ để hiển thị, không dùng để chấm điểm)
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "ja-JP";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setWebSpeechText(transcript);
    };
    recognition.onerror = (event: any) => {
      console.error("Web Speech error", event.error);
    };
    recognitionRef.current = recognition;
  }, []);

  const startWebSpeech = () => {
    if (recognitionRef.current) {
      recognitionRef.current.start();
    } else {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói.");
    }
  };

  const startRecording = async () => {
    if (!expectedText.trim()) {
      alert("Vui lòng nhập câu tiếng Nhật muốn luyện trước.");
      return;
    }
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
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("expected_text", expectedText);

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
    setWebSpeechText("");
    setIsRecording(false);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Câu tiếng Nhật muốn luyện
        </label>
        <input
          type="text"
          value={expectedText}
          onChange={(e) => setExpectedText(e.target.value)}
          placeholder="Ví dụ: こんにちは、お元気ですか"
          className="w-full p-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <div className="flex flex-wrap gap-4 mt-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              Ghi âm & Đánh giá
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              ⏹️ Dừng ghi âm
            </button>
          )}
        </div>
        {webSpeechText && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-600 dark:text-blue-400">Web Speech nhận diện:</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{webSpeechText}</p>
          </div>
        )}
        {isProcessing && (
          <div className="mt-4 text-center text-sm text-gray-500">Đang xử lý...</div>
        )}
      </div>
      <EvaluationDisplay evaluation={evaluation} onTryAgain={handleTryAgain} />
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
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            onClick={() => setActiveMode("predefined")}
            className={`rounded-lg px-6 py-4 font-medium transition-all ${
              activeMode === "predefined"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Từ có sẵn</div>
            <div className={`text-sm ${activeMode === "predefined" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Chọn từ trong danh sách
            </div>
          </button>
          <button
            onClick={() => setActiveMode("voice")}
            className={`rounded-lg px-6 py-4 font-medium transition-all ${
              activeMode === "voice"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600"
            }`}
          >
            <div className="font-semibold">Nhận diện giọng nói</div>
            <div className={`text-sm ${activeMode === "voice" ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
              Nhập câu và ghi âm để đánh giá
            </div>
          </button>
        </div>

        {activeMode === "predefined" ? <PredefinedMode /> : <VoiceMode />}
      </div>
    </>
  );
}