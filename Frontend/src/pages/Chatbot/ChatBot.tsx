import { useEffect, useRef } from "react";
import ScenarioSidebar from "../../components/ScenarioSidebar";
import ChatMessage from "../../components/ChatMessage";
import ChatInput from "../../components/ChatInput";
import { useChatConversation } from "./hooks/useChatConversation";
import "../../styles/chatbot.css";

export default function ChatBot() {
  const chat = useChatConversation();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const statusLabel = chat.activeScenario ? chat.activeScenario.title : "Tự do";

  return (
    <div className="chatbot-root">
      {chat.backendStatus === "error" && <div className="status-banner error">⚠️ {chat.statusMsg}</div>}

      <div className="chatbot-layout">
        <ScenarioSidebar
          scenarios={chat.scenarios}
          activeScenarioId={chat.activeScenario?.id ?? null}
          onSelect={chat.handleSelectScenario}
          loading={chat.scenariosLoading}
        />

        <main className="chat-panel">
          <div className="chat-header">
            <div className="chat-avatar-icon">🎓</div>
            <div className="chat-title-group">
              <h1>Kizuna Sensei</h1>
              <p className="chat-subtitle">
                <span className={`status-dot ${chat.backendStatus === "ok" ? "online" : "offline"}`} />
                {chat.isThinking
                  ? "Đang suy nghĩ..."
                  : chat.isSpeaking
                  ? "Đang nói..."
                  : `Đang nghe... (${statusLabel})`}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="btn-clear" onClick={chat.handleClearChat} title="Bắt đầu lại">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
                  <polyline points="1 4 1 10 7 10" />
                  <polyline points="23 20 23 14 17 14" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                Bắt đầu lại
              </button>
            </div>
          </div>

          <div className="messages-area">
            {chat.messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {chat.isThinking && (
              <div className="chat-message assistant">
                <div className="avatar-badge">
                  <span>AI</span>
                </div>
                <div className="bubble-wrap">
                  <div className="bubble typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {chat.suggestions.length > 0 && (
            <div className="suggestion-chips">
              {chat.suggestions.map((s, i) => (
                <button key={i} type="button" className="suggestion-chip" onClick={() => chat.handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <ChatInput
            onSend={chat.handleSend}
            onVoiceStart={chat.startListening}
            onVoiceStop={chat.stopListening}
            isListening={chat.isListening}
            isLoading={chat.isLoading}
            transcript={chat.transcript}
            voiceSupported={chat.voiceSupported}
          />
        </main>
      </div>
    </div>
  );
}
