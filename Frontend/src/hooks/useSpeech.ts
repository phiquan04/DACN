// src/hooks/useSpeech.ts
// Handles Japanese TTS via Web Speech API + lip-sync timing from backend

import { useCallback, useRef, useState } from "react";
import { getTTSData } from "../services/api";

export interface LipsyncFrame {
  time_ms: number;
  mouth_open: number;
}

interface UseSpeechReturn {
  speak: (text: string, onMouthUpdate: (v: number) => void) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, onMouthUpdate: (v: number) => void) => {
      stop();

      // Fetch lip-sync keyframes from backend
      let keyframes: LipsyncFrame[] = [];
      try {
        const ttsData = await getTTSData(text);
        keyframes = ttsData.lipsync_keyframes;
      } catch {
        // Fallback: simple open/close every 150ms
        keyframes = Array.from({ length: 20 }, (_, i) => ({
          time_ms: i * 150,
          mouth_open: i % 2 === 0 ? 0.7 : 0.2,
        }));
        keyframes.push({ time_ms: 3000, mouth_open: 0 });
      }

      // Configure Web Speech API for Japanese
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 0.9;
      utterance.pitch = 1.1;

      // Try to find a Japanese voice
      const voices = window.speechSynthesis.getVoices();
      const jaVoice = voices.find(
        (v) => v.lang.startsWith("ja") && v.localService
      ) || voices.find((v) => v.lang.startsWith("ja"));
      if (jaVoice) utterance.voice = jaVoice;

      utteranceRef.current = utterance;
      setIsSpeaking(true);

      // Animate mouth using keyframes
      const startTime = performance.now();
      let frameIdx = 0;

      const animate = () => {
        const elapsed = performance.now() - startTime;
        // Find current keyframe
        while (
          frameIdx < keyframes.length - 1 &&
          keyframes[frameIdx + 1].time_ms <= elapsed
        ) {
          frameIdx++;
        }
        const current = keyframes[frameIdx];
        const next = keyframes[Math.min(frameIdx + 1, keyframes.length - 1)];

        // Interpolate between keyframes
        const segDuration = next.time_ms - current.time_ms;
        const segElapsed = elapsed - current.time_ms;
        const t = segDuration > 0 ? Math.min(segElapsed / segDuration, 1) : 1;
        const mouthValue =
          current.mouth_open + (next.mouth_open - current.mouth_open) * t;

        onMouthUpdate(mouthValue);

        if (elapsed < (keyframes[keyframes.length - 1]?.time_ms ?? 3000)) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };

      utterance.onstart = () => {
        animFrameRef.current = requestAnimationFrame(animate);
      };

      utterance.onend = () => {
        onMouthUpdate(0);
        setIsSpeaking(false);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      utterance.onerror = () => {
        onMouthUpdate(0);
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [stop]
  );

  return { speak, stop, isSpeaking };
}