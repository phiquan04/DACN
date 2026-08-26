import { useCallback, useRef, useState } from "react";
import { BASE_URL, getSupportedMimeType, type EvaluationResult } from "../pronunciationUtils";

interface UseAudioRecordingOptions {
  /** Text to assess the recording against. */
  getExpectedText: () => string;
  /** Shown via alert() when getExpectedText() is empty; omit to silently no-op instead (PredefinedMode's button is disabled in that case, so it never needs one). */
  notReadyMessage?: string;
  noDataMessage: string;
  micErrorMessage: string;
  /** PredefinedMode also resets isProcessing on a mic-access error; VoiceMode doesn't (it's already false there). */
  resetProcessingOnMicError?: boolean;
}

/** Shared MediaRecorder + /api/pronunciation/assess flow used by both PredefinedMode and VoiceMode. */
export function useAudioRecording({
  getExpectedText,
  notReadyMessage,
  noDataMessage,
  micErrorMessage,
  resetProcessingOnMicError = false,
}: UseAudioRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");

  const clearRecordedAudio = useCallback(() => {
    setRecordedAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const playRecording = useCallback(() => {
    if (!recordedAudioUrl) return;
    new Audio(recordedAudioUrl).play();
  }, [recordedAudioUrl]);

  const startRecording = useCallback(async () => {
    const expectedText = getExpectedText();
    if (!expectedText) {
      if (notReadyMessage) alert(notReadyMessage);
      return;
    }
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
          alert(noDataMessage);
          setIsProcessing(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeTypeRef.current || "audio/webm",
        });
        setRecordedAudioUrl(URL.createObjectURL(audioBlob));

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
      alert(micErrorMessage);
      setIsRecording(false);
      if (resetProcessingOnMicError) setIsProcessing(false);
    }
  }, [getExpectedText, notReadyMessage, noDataMessage, micErrorMessage, resetProcessingOnMicError, clearRecordedAudio]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const tryAgain = useCallback(() => {
    setEvaluation(null);
    setIsRecording(false);
    setIsProcessing(false);
    clearRecordedAudio();
  }, [clearRecordedAudio]);

  return {
    isRecording,
    isProcessing,
    evaluation,
    setEvaluation,
    recordedAudioUrl,
    startRecording,
    stopRecording,
    tryAgain,
    playRecording,
    clearRecordedAudio,
  };
}
