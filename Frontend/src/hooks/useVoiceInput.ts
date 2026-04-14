
import { useCallback, useRef, useState } from "react";

const SILENCE_DELAY_MS = 1500; // chờ im lặng bao lâu trước khi gửi

interface UseVoiceInputReturn {
  isListening: boolean;
  transcript: string;
  isSilent: boolean;        // đang đếm ngược im lặng
  startListening: () => void;
  stopListening: () => void;
  supported: boolean;
}

export function useVoiceInput(
  onResult: (text: string) => void
): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSilent, setIsSilent] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedRef = useRef<string>(""); // toàn bộ câu tích lũy

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  /** Xóa bộ đếm im lặng hiện tại */
  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setIsSilent(false);
  };

  /** Bắt đầu đếm ngược — nếu hết giờ mà chưa nói tiếp thì gửi */
  const startSilenceTimer = useCallback((textToSend: string) => {
    clearSilenceTimer();
    setIsSilent(true);
    silenceTimerRef.current = setTimeout(() => {
      setIsSilent(false);
      if (textToSend.trim()) {
        onResult(textToSend.trim());
        accumulatedRef.current = "";
        setTranscript("");
      }
    }, SILENCE_DELAY_MS);
  }, [onResult]);

  const startListening = useCallback(() => {
    if (!supported) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "ja-JP";
    recognition.interimResults = true;   // hiển thị text tạm thời
    recognition.maxAlternatives = 1;
    recognition.continuous = false;      // dừng tự động sau khi im lặng

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interimText += t;
        }
      }

      // Cộng dồn các đoạn final vào câu tổng
      if (finalText) {
        accumulatedRef.current += finalText;
      }

      // Hiển thị: câu tích lũy + phần interim đang nói
      const display = accumulatedRef.current + interimText;
      setTranscript(display);

      // Mỗi khi có text mới → reset đồng hồ im lặng
      clearSilenceTimer();
      if (display.trim()) {
        startSilenceTimer(accumulatedRef.current + interimText);
      }
    };

    recognition.onend = () => {
      // Nếu còn text chưa gửi thì gửi ngay khi recognition kết thúc
      clearSilenceTimer();
      if (accumulatedRef.current.trim()) {
        onResult(accumulatedRef.current.trim());
        accumulatedRef.current = "";
        setTranscript("");
      }
      setIsListening(false);
    };

    recognition.onerror = (e) => {
      // 'no-speech' là lỗi bình thường khi im lặng quá lâu
      if (e.error !== "no-speech") {
        console.warn("Speech recognition error:", e.error);
      }
      clearSilenceTimer();
      setIsListening(false);
    };

    accumulatedRef.current = "";
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [supported, onResult, startSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    recognitionRef.current?.stop();
    accumulatedRef.current = "";
    setTranscript("");
    setIsListening(false);
  }, []);

  return { isListening, transcript, isSilent, startListening, stopListening, supported };
}