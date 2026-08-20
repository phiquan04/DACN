// src/hooks/useSpeech.ts
// Japanese TTS via the browser's Web Speech API

import { useCallback, useRef, useState } from "react";

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      const voices = window.speechSynthesis.getVoices();
      const jaVoice =
        voices.find((v) => v.lang.startsWith("ja") && v.localService) ||
        voices.find((v) => v.lang.startsWith("ja"));
      if (jaVoice) utterance.voice = jaVoice;

      utteranceRef.current = utterance;
      setIsSpeaking(true);

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [stop]
  );

  return { speak, stop, isSpeaking };
}
