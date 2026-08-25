import { useCallback, useEffect, useRef, useState } from "react";
import type { Segment, YouTubeVideo } from "../japaneseVideoUtils";

// Load YouTube IFrame API
if (typeof window !== "undefined" && !(window as any).YT) {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

/** Owns the embedded YouTube player: init via the IFrame API, and syncing the active transcript segment to playback position. */
export function useYouTubePlayer(selectedVideo: YouTubeVideo | null, segments: Segment[]) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<any>(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  // ── Initialize YouTube Player ──
  useEffect(() => {
    if (!selectedVideo || !iframeRef.current) return;

    const initPlayer = () => {
      if ((window as any).YT?.Player) {
        playerRef.current = new (window as any).YT.Player(iframeRef.current, {
          events: {
            onReady: () => {},
            onStateChange: () => {},
          },
        });
      }
    };

    // Wait for YouTube API to be ready
    if ((window as any).YT?.Player) {
      initPlayer();
    } else {
      const checkYT = setInterval(() => {
        if ((window as any).YT?.Player) {
          initPlayer();
          clearInterval(checkYT);
        }
      }, 100);
      return () => clearInterval(checkYT);
    }
  }, [selectedVideo]);

  // ── Poll player time and sync script ──
  useEffect(() => {
    if (!playerRef.current || segments.length === 0) return;

    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        try {
          const ct = playerRef.current.getCurrentTime();
          const idx = segments.findIndex((s) => ct >= s.start && ct < s.end);
          if (idx >= 0 && idx !== activeIdx) {
            setActiveIdx(idx);
          }
        } catch {}
      }
    }, 300);

    return () => clearInterval(interval);
  }, [segments, activeIdx]);

  // ── Seek via YouTube API ──
  const seekTo = useCallback((start: number, idx: number) => {
    setActiveIdx(idx);
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(start, true);
      playerRef.current.playVideo();
    }
  }, []);

  return { iframeRef, activeIdx, setActiveIdx, seekTo };
}
