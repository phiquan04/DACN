// src/components/ChatInput.tsx

import React, { useState, useRef } from "react";

interface Props {
  onSend: (text: string) => void;
  onVoiceStart: () => void;
  onVoiceStop: () => void;
  isListening: boolean;
  isLoading: boolean;
  transcript: string;
  voiceSupported: boolean;
}

const ChatInput: React.FC<Props> = ({
  onSend,
  onVoiceStart,
  onVoiceStop,
  isListening,
  isLoading,
  transcript,
  voiceSupported,
}) => {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const msg = text.trim();
    if (!msg || isLoading) return;
    onSend(msg);
    setText("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayValue = isListening ? transcript : text;

  return (
    <div className="chat-input-container">
      <div className="input-row">
        <textarea
          ref={inputRef}
          className="chat-textarea"
          value={displayValue}
          onChange={(e) => !isListening && setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening ? "🎤 Đang nghe..." : "Nhập câu trả lời bằng tiếng Nhật hoặc tiếng Việt..."
          }
          rows={2}
          disabled={isLoading || isListening}
        />
        <div className="input-actions">
          {voiceSupported && (
            <button
              className={`btn-icon ${isListening ? "listening" : ""}`}
              onClick={isListening ? onVoiceStop : onVoiceStart}
              title={isListening ? "停止" : "音声入力"}
              disabled={isLoading}
            >
              {isListening ? (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <rect x="6" y="6" width="12" height="12" rx="2"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                </svg>
              )}
            </button>
          )}
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={isLoading || (!text.trim() && !transcript)}
            title="送信"
          >
            {isLoading ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" className="spin">
                <circle cx="12" cy="12" r="10" strokeWidth="3" strokeDasharray="30 70"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="input-hint">Nhấn Micro để nói, hoặc nhấn Enter để gửi tin nhắn.</p>
    </div>
  );
};

export default ChatInput;