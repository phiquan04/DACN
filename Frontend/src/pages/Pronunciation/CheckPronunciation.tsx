import { useState, useEffect, useRef } from "react";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

// Dữ liệu mẫu cho danh sách từ có sẵn
const wordList = [
  { word: "ありがとう", reading: "arigatou", meaning: "cảm ơn" },
  { word: "おはよう", reading: "ohayou", meaning: "chào buổi sáng" },
  { word: "こんにちは", reading: "konnichiwa", meaning: "xin chào" },
  { word: "さようなら", reading: "sayounara", meaning: "tạm biệt" },
];

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

// =====================================================================
// ✅ FIX: Hàm lấy MIME type thực sự mà trình duyệt hỗ trợ
// MediaRecorder KHÔNG THỂ ghi ra audio/wav - chỉ hỗ trợ webm hoặc ogg
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
  // Fallback: để trình duyệt tự chọn
  return "";
}

// Hàm mô phỏng đánh giá phát âm cho từ có sẵn (dùng khi backend không khả dụng)
const simulatePredefinedEvaluation = (word: string): EvaluationResult => {
  const baseScore = Math.min(90, 70 + word.length * 5);
  const accent = Math.floor(Math.random() * 30) + 70;
  const intonation = Math.floor(Math.random() * 35) + 65;
  const speed = Math.floor(Math.random() * 25) + 75;
  const overall = Math.floor((accent + intonation + speed) / 3);

  let tip = "";
  if (intonation < 70) tip = "Cần chú ý giọng điệu lên xuống tự nhiên hơn.";
  else if (accent < 75) tip = "Âm đầu chưa rõ ràng, hãy phát âm chậm và chính xác hơn.";
  else if (speed > 90) tip = "Tốc độ hơi nhanh, hãy thử nói chậm lại một chút.";
  else tip = "Phát âm khá tốt, hãy duy trì và luyện tập thêm.";

  return { overall, accent, intonation, speed, tip };
};

// Hàm mô phỏng đánh giá cho VoiceMode (dùng Web Speech API, không có backend)
const simulateVoiceEvaluation = (recognizedText: string): EvaluationResult => {
  if (!recognizedText.trim()) {
    return {
      overall: 0,
      accent: 0,
      intonation: 0,
      speed: 0,
      tip: "Không nhận diện được giọng nói. Hãy thử lại với âm lượng lớn hơn và nói rõ ràng.",
    };
  }
  const lengthFactor = Math.min(85, 60 + recognizedText.length * 2);
  const accent = Math.floor(Math.random() * 30) + 65;
  const intonation = Math.floor(Math.random() * 35) + 60;
  const speed = Math.floor(Math.random() * 25) + 70;
  const overall = Math.floor((accent + intonation + speed + lengthFactor) / 4);

  let tip = "";
  if (recognizedText.length < 3) tip = "Câu nói quá ngắn, hãy thử nói một câu dài hơn.";
  else if (intonation < 65) tip = "Ngữ điệu chưa tự nhiên, hãy nghe lại phát âm chuẩn.";
  else if (accent < 70) tip = "Cần chú ý trọng âm của từng từ.";
  else tip = "Phát âm tốt, hãy luyện thêm để cải thiện ngữ điệu.";

  return { overall, accent, intonation, speed, tip };
};

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
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>Chưa có đánh giá nào.</p>
          <p className="text-sm">Hãy nhấn nút ghi âm để bắt đầu.</p>
        </div>
        <div className="mt-4 flex justify-center">
          <Button size="sm" variant="outline" onClick={onTryAgain}>
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        Kết quả đánh giá
      </h3>

      {/* Banner sai từ - hiển thị nổi bật khi phát âm sai từ */}
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

      {/* Hiển thị văn bản Whisper nhận diện được (chỉ khi không sai từ) */}
      {!evaluation.wrong_word && evaluation.recognized_text !== undefined && (
        <div className="mb-4 rounded-md bg-blue-50 p-3 dark:bg-blue-500/10">
          <p className="text-xs text-blue-600 dark:text-blue-400">Whisper nhận diện:</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {evaluation.recognized_text || "(không nhận diện được)"}
          </p>
        </div>
      )}

      {/* Điểm tổng thể - ẩn các thanh điểm khi sai từ */}
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
                <div
                  className="h-2 rounded-full bg-green-500"
                  style={{ width: `${evaluation.accent}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Ngữ điệu</span>
                <span className="font-semibold">{evaluation.intonation}/100</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-yellow-500"
                  style={{ width: `${evaluation.intonation}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Tốc độ nói</span>
                <span className="font-semibold">{evaluation.speed}/100</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${evaluation.speed}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300">
            💡 {evaluation.tip}
          </div>
        </>
      ) : (
        /* Khi sai từ: chỉ hiển thị tip nhắc nhở */
        <div className="mt-2 rounded-md bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-500/10 dark:text-orange-300">
          💡 Hãy nghe kỹ từ mẫu trước khi phát âm lại.
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button size="sm" variant="outline" onClick={onTryAgain}>
          Thử lại
        </Button>
      </div>
    </div>
  );
};

// =====================================================================
// Component cho chế độ từ có sẵn
// =====================================================================
const PredefinedMode = ({ onSwitchMode }: { onSwitchMode?: () => void }) => {
  const [selectedWord, setSelectedWord] = useState(wordList[0]);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // ✅ FIX: Lưu mimeType thực tế để dùng lại khi tạo Blob
  const mimeTypeRef = useRef<string>("");

  const handlePlayStandard = () => {
    // Dùng Web Speech API để phát âm chuẩn
    const utterance = new SpeechSynthesisUtterance(selectedWord.word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  // =====================================================================
  // ✅ FIX: handleStartRecording - dùng MIME type thực của trình duyệt
  // =====================================================================
  // Thay thế toàn bộ hàm handleStartRecording và handleStopRecording như sau:

const handleStartRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType;
    const options = mimeType ? { mimeType } : {};
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        console.log(`Chunk size: ${event.data.size} bytes`);
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // ✅ Gom tất cả chunk lại
      const actualMime = mimeTypeRef.current || "audio/webm";
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
      console.log(`Final blob size: ${audioBlob.size} bytes`);

      if (audioBlob.size < 5000) {
        alert("File ghi âm quá nhỏ (có thể do lỗi microphone). Hãy thử lại và nói to hơn.");
        setIsRecording(false);
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      const ext = actualMime.includes("ogg") ? "ogg" : "webm";
      formData.append("audio", audioBlob, `recording.${ext}`);
      formData.append("expected_text", selectedWord.word);

      setIsProcessing(true);
      try {
        const response = await fetch("http://localhost:8080/api/pronunciation/assess", {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        if (response.ok) {
          setEvaluation({
            overall: data.overall,
            accent: data.accent,
            intonation: data.intonation,
            speed: data.speed,
            tip: data.tip,
            recognized_text: data.recognized_text,
            wrong_word: data.wrong_word ?? false,
          });
        } else {
          alert(data.error || "Lỗi đánh giá phát âm");
        }
      } catch (err) {
        console.error(err);
        alert("Không thể kết nối backend");
      } finally {
        setIsProcessing(false);
        setIsRecording(false);
        // Dừng tất cả track
        stream.getTracks().forEach(track => track.stop());
      }
    };

    // ✅ Tăng timeslice lên 1000ms để có chunk lớn hơn, hoặc bỏ hẳn (mặc định gom toàn bộ)
    mediaRecorder.start(1000); // hoặc mediaRecorder.start() nếu muốn gom đến khi stop
    setIsRecording(true);
  } catch (err) {
    console.error("Lỗi khi bắt đầu ghi âm:", err);
    alert("Không thể truy cập microphone.");
  }
};

const handleStopRecording = () => {
  const recorder = mediaRecorderRef.current;
  if (recorder && recorder.state !== "inactive") {
    recorder.stop(); // Không cần requestData() nữa
  }
};

  const handleTryAgain = () => {
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
  };

  const handleSelectWord = (item: (typeof wordList)[0]) => {
    setSelectedWord(item);
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Danh sách từ */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white/90">
          📖 Chọn từ để luyện
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {wordList.map((item) => (
            <button
              key={item.word}
              onClick={() => handleSelectWord(item)}
              disabled={isRecording || isProcessing}
              className={`rounded-lg border p-3 text-left transition-all ${
                selectedWord.word === item.word
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
              } ${isRecording || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="text-lg font-bold text-gray-900 dark:text-white">{item.word}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{item.reading}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{item.meaning}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Điều khiển phát âm */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h3 className="mb-3 text-md font-semibold text-gray-800 dark:text-white/90">
          Đang luyện: {selectedWord.word}
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePlayStandard}
            disabled={isRecording || isProcessing}
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            Nghe phát âm chuẩn
          </Button>

          {isProcessing ? (
            <Button size="sm" disabled>
              <svg className="mr-1 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Đang xử lý...
            </Button>
          ) : !isRecording ? (
            <Button size="sm" onClick={handleStartRecording}>
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Nhấn để ghi âm
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleStopRecording}>
              <svg className="mr-1 h-4 w-4 animate-pulse text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
              </svg>
              Dừng ghi âm
            </Button>
          )}
        </div>
      </div>

      {/* Kết quả đánh giá */}
      <EvaluationDisplay evaluation={evaluation} onTryAgain={handleTryAgain} />
    </div>
  );
};

// =====================================================================
// Component cho chế độ nhận diện giọng nói (dùng Web Speech API)
// =====================================================================
const VoiceMode = () => {
  const [isListening, setIsListening] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert(
        "Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome, Edge hoặc Safari."
      );
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = "ja-JP";

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setRecognizedText(transcript);
      setIsListening(false);
      const result = simulateVoiceEvaluation(transcript);
      setEvaluation(result);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      alert("Lỗi nhận diện giọng nói: " + event.error);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const handleStartListening = () => {
    if (!recognitionRef.current) {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói.");
      return;
    }
    setRecognizedText("");
    setEvaluation(null);
    setIsListening(true);
    recognitionRef.current.start();
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleTryAgain = () => {
    if (recognizedText) {
      const result = simulateVoiceEvaluation(recognizedText);
      setEvaluation(result);
    } else {
      alert("Hãy nói vào microphone trước.");
    }
  };

  const handlePlayStandard = () => {
    if (!recognizedText) {
      alert("Chưa có văn bản nào được nhận diện. Hãy nói trước.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(recognizedText);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white/90">
          🎤 Phát âm bằng giọng nói
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Nhấn nút bên dưới và nói một câu tiếng Nhật. Hệ thống sẽ nhận diện và đánh giá phát âm
          của bạn.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          {!isListening ? (
            <Button size="sm" onClick={handleStartListening}>
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Bắt đầu ghi âm
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" disabled>
                <svg
                  className="mr-1 h-4 w-4 animate-pulse text-red-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="8" />
                </svg>
                Đang nghe...
              </Button>
              <Button size="sm" onClick={handleStopListening}>
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 4a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2V4z"
                  />
                </svg>
                Dừng ghi âm
              </Button>
            </>
          )}
        </div>

        {recognizedText && (
          <div className="mb-6 rounded-md bg-blue-50 p-4 dark:bg-blue-500/10">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Văn bản nhận diện được:
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {recognizedText}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={handlePlayStandard}>
                Nghe phát âm chuẩn
              </Button>
            </div>
          </div>
        )}
      </div>

      <EvaluationDisplay evaluation={evaluation} onTryAgain={handleTryAgain} />
    </div>
  );
};

export default function CheckPronunciation() {
  const [activeMode, setActiveMode] = useState<"predefined" | "voice">("predefined");

  return (
    <>
      <PageMeta
        title="Kiểm tra phát âm tiếng Nhật"
        description="Luyện phát âm từ có sẵn hoặc sử dụng giọng nói để nhận diện và sửa phát âm"
      />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-8 flex justify-center gap-4">
          <button
            onClick={() => setActiveMode("predefined")}
            className={`rounded-lg px-6 py-2 font-medium transition-all ${
              activeMode === "predefined"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            📚 Từ có sẵn
          </button>
          <button
            onClick={() => setActiveMode("voice")}
            className={`rounded-lg px-6 py-2 font-medium transition-all ${
              activeMode === "voice"
                ? "bg-brand-600 text-white shadow-md"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            🎤 Nhận diện giọng nói
          </button>
        </div>

        {activeMode === "predefined" ? <PredefinedMode /> : <VoiceMode />}
      </div>
    </>
  );
}