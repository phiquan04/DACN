
import React, { useState, useRef, useEffect, useCallback } from "react";
import VideoAvatar from "../../components/VideoAvatar";
import ChatMessage from "../../components/ChatMessage";
import ChatInput from "../../components/ChatInput";
import { useSpeech } from "../../hooks/useSpeech";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import { sendChatMessage, checkHealth } from "../../services/api";
import type { ChatMessage as ChatMsg } from "../../services/api";
import "../../styles/chatbot.css";

const WELCOME_MESSAGE: ChatMsg = {
  role: "assistant",
  content:
    "こんにちは！私はAIアシスタントの「ミク」です。😊 何でも日本語でお話しください。どんなことでもお手伝いします！",
  timestamp: Date.now(),
};

export default function ChatBot() {
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");
  const [statusMsg, setStatusMsg] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const { speak, stop, isSpeaking } = useSpeech();

  // Initialize voice input first (before using in callback)
  const handleVoiceResultRef = useRef<(transcript: string) => void | null>(null);
  
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    supported: voiceSupported,
  } = useVoiceInput((text) => {
    if (handleVoiceResultRef.current && text.trim()) {
      handleVoiceResultRef.current(text);
    }
  });

  // Check backend on mount
  useEffect(() => {
    checkHealth().then((ok) => {
      setBackendStatus(ok ? "ok" : "error");
      if (!ok) setStatusMsg("バックエンドに接続できません。Flaskサーバーを起動してください。");
    });
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      stop(); // Stop any ongoing speech
      stopListening(); // Stop voice recording

      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setIsThinking(true);

      try {
        const history = messages.slice(-8); // Last 8 messages for context
        const response = await sendChatMessage(text, history);

        const assistantMsg: ChatMsg = {
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsThinking(false);

        // Speak the response
        await speak(response.reply, setMouthOpen);
      } catch (err: any) {
        setIsThinking(false);
        const errMsg: ChatMsg = {
          role: "assistant",
          content: `エラーが発生しました。😢 ${err.message || "もう一度試してください。"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, speak, stop, stopListening]
  );

  // Update ref for voice result handler
  useEffect(() => {
    handleVoiceResultRef.current = (transcript: string) => {
      if (transcript.trim()) handleSend(transcript);
    };
  }, [handleSend]);

  const handleClearChat = () => {
    stop();
    setMessages([WELCOME_MESSAGE]);
  };

  return (
    <div className="chatbot-root">
      {/* Status Banner */}
      {backendStatus === "error" && (
        <div className="status-banner error">
          ⚠️ {statusMsg}
        </div>
      )}

      <div className="chatbot-layout">
        {/* ── Left: Avatar Panel ────────────────────────────────────── */}
        <aside className="avatar-panel">
          <div className="avatar-header">
            <div className="avatar-name-badge">
              <span className="avatar-name">ミク</span>
              <span className={`status-dot ${backendStatus === "ok" ? "online" : "offline"}`} />
            </div>
            <p className="avatar-subtitle">AIアシスタント</p>
          </div>

          <div className="avatar-stage">
            <div className="avatar-glow" />
            <VideoAvatar
              mouthOpen={mouthOpen}
              isSpeaking={isSpeaking}
              isThinking={isThinking}
            />
            <div className="avatar-state-label">
              {isThinking && (
                <span className="state-chip thinking">
                  <span className="dot-pulse" />考え中...
                </span>
              )}
              {isSpeaking && !isThinking && (
                <span className="state-chip speaking">
                  <span className="wave-icon">🎵</span>話し中...
                </span>
              )}
              {!isSpeaking && !isThinking && (
                <span className="state-chip idle">待機中</span>
              )}
            </div>
          </div>

          <div className="avatar-info-card">
            <h3>📚 JLPT N3レベル</h3>
            <p>自然な日本語で会話できます</p>
            <div className="tag-row">
              <span className="tag">日本語</span>
              <span className="tag">AI</span>
              <span className="tag">音声</span>
            </div>
          </div>
        </aside>

        {/* ── Right: Chat Panel ─────────────────────────────────────── */}
        <main className="chat-panel">
          <div className="chat-header">
            <div className="chat-title-group">
              <h1>日本語AIアシスタント</h1>
              <p className="chat-subtitle">Japanese Virtual Assistant</p>
            </div>
            <button className="btn-clear" onClick={handleClearChat} title="チャットをクリア">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
              リセット
            </button>
          </div>

          <div className="messages-area">
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {isThinking && (
              <div className="chat-message assistant">
                <div className="avatar-badge"><span>AI</span></div>
                <div className="bubble-wrap">
                  <div className="bubble typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <ChatInput
            onSend={handleSend}
            onVoiceStart={startListening}
            onVoiceStop={stopListening}
            isListening={isListening}
            isLoading={isLoading}
            transcript={transcript}
            voiceSupported={voiceSupported}
          />
        </main>
      </div>
    </div>
  );
}