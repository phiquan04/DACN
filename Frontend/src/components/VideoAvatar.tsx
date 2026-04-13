import React, { useEffect, useRef } from "react";

interface VideoAvatarProps {
  mouthOpen: number;      // 0.0 = closed, 1.0 = fully open (for future lip-sync)
  isSpeaking: boolean;
  isThinking: boolean;
}

/**
 * Real person video avatar component
 * Displays a video of a real person with optional lip-sync control
 */
const VideoAvatar: React.FC<VideoAvatarProps> = ({
  mouthOpen,
  isSpeaking,
  isThinking,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-play video on speaking
  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isSpeaking) {
      videoRef.current.play().catch(() => {
        // Video might already be playing or user hasn't interacted yet
      });
    } else if (!isSpeaking && !isThinking) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  }, [isSpeaking, isThinking]);

  // Future: Use mouthOpen to select different video clips or adjust video playback
  // For now, mouthOpen can be used for more advanced lip-sync features

  return (
    <div className="video-avatar-container">
      {/* Background blur effect */}
      <div className="video-avatar-blur" />
      
      {/* Main video */}
      <div className="video-wrapper">
        <video
          ref={videoRef}
          className="avatar-video"
          loop
          muted
          playsInline
          crossOrigin="anonymous"
        >
          {/* Replace with your actual video file */}
          <source src="/videos/avatar.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Overlay glow effect when speaking */}
      {isSpeaking && <div className="video-avatar-glow" />}

      {/* Status indicators */}
      <div className="video-avatar-status">
        {isThinking && (
          <div className="status-thinking">
            <span className="dot-pulse" />
            考え中...
          </div>
        )}
        {isSpeaking && !isThinking && (
          <div className="status-speaking">
            <span className="wave-icon">🎵</span>
            話し中...
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoAvatar;
