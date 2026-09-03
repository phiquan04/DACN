import { useCallback, useEffect, useRef, useState } from "react";
import type { Segment, YouTubeVideo } from "../japaneseVideoUtils";

/** The small slice of the YouTube IFrame Player API this hook actually calls. */
interface YTPlayer {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
}

interface YTPlayerOptions {
  events: {
    onReady: () => void;
    onStateChange: () => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLIFrameElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
  }
}

// Load YouTube IFrame API
if (typeof window !== "undefined" && !window.YT) {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
}

/** Owns the embedded YouTube player: init via the IFrame API, and syncing the active transcript segment to playback position. */
export function useYouTubePlayer(selectedVideo: YouTubeVideo | null, segments: Segment[]) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [playerReady, setPlayerReady] = useState(false);
  // Which video.id already has a live YT.Player attached — guards against
  // creating a second, conflicting player on the same iframe when React
  // StrictMode double-invokes this effect on mount (happens whenever the
  // component mounts with selectedVideo already set, e.g. opening a video
  // straight from Lịch sử instead of picking one from search).
  const initializedIdRef = useRef<string | null>(null);

  // ── Initialize YouTube Player ──
  useEffect(() => {
    setPlayerReady(false);
    if (!selectedVideo || !iframeRef.current) return;

    const initPlayer = () => {
      if (!window.YT?.Player) return;
      if (initializedIdRef.current === selectedVideo.id && playerRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current!, {
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: () => {},
        },
      });
      initializedIdRef.current = selectedVideo.id;
    };

    // Wait for YouTube API to be ready
    if (window.YT?.Player) {
      initPlayer();
    } else {
      const checkYT = setInterval(() => {
        if (window.YT?.Player) {
          initPlayer();
          clearInterval(checkYT);
        }
      }, 100);
      return () => clearInterval(checkYT);
    }
  }, [selectedVideo]);

  // ── Poll player time and sync script ──
  useEffect(() => {
    if (!playerReady || !playerRef.current || segments.length === 0) return;

    const interval = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        try {
          const ct = playerRef.current.getCurrentTime();
          const idx = segments.findIndex((s) => ct >= s.start && ct < s.end);
          if (idx >= 0 && idx !== activeIdx) {
            setActiveIdx(idx);
          }
        } catch {
          // player not fully ready yet — skip this tick, the next poll retries
        }
      }
    }, 300);

    return () => clearInterval(interval);
  }, [segments, activeIdx, playerReady]);

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
