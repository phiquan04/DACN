
import React, { useState, useRef, useEffect, useCallback } from "react";
import ScenarioSidebar from "../../components/ScenarioSidebar";
import ChatMessage from "../../components/ChatMessage";
import ChatInput from "../../components/ChatInput";
import { useSpeech } from "../../hooks/useSpeech";
import { useVoiceInput } from "../../hooks/useVoiceInput";
import {
  streamChatMessage,
  checkHealth,
  fetchScenarios,
  startConversation,
} from "../../services/api";
import type { ChatMessage as ChatMsg, ChatScenario } from "../../services/api";
import "../../styles/chatbot.css";

const FREE_CHAT_WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "こんにちは！私はKizunaです。左のリストからシチュエーションを選ぶか、自由に日本語で話しかけてください。",
  timestamp: Date.now(),
};

export default function ChatBot() {
  const [scenarios, setScenarios] = useState<ChatScenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<ChatScenario | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([FREE_CHAT_WELCOME]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");
  const [statusMsg, setStatusMsg] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const { speak, stop, isSpeaking } = useSpeech();

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

  // Check backend + load scenarios on mount
  useEffect(() => {
    checkHealth().then((ok) => {
      setBackendStatus(ok ? "ok" : "error");
      if (!ok) setStatusMsg("バックエンドに接続できません。サーバーを起動してください。");
    });
    fetchScenarios()
      .then(setScenarios)
      .finally(() => setScenariosLoading(false));
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Abort any in-flight chat stream if the page is left mid-reply
  useEffect(() => {
    return () => streamAbortRef.current?.abort();
  }, []);

  const initConversation = useCallback(
    async (scenario: ChatScenario | null) => {
      streamAbortRef.current?.abort();
      stop();
      stopListening();
      setIsLoading(true);
      setSuggestions([]);
      try {
        const res = await startConversation(scenario?.id);
        setConversationId(res.conversation_id);
        setActiveScenario(scenario);

        if (res.opening_message) {
          const opening: ChatMsg = {
            role: "assistant",
            content: res.opening_message.content,
            timestamp: Date.now(),
          };
          setMessages([opening]);
          speak(opening.content);
        } else {
          setMessages([FREE_CHAT_WELCOME]);
        }
      } catch (err: any) {
        setMessages([
          {
            role: "assistant",
            content: `エラーが発生しました。😢 ${err.message || "もう一度試してください。"}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [speak, stop, stopListening]
  );

  // Start a free-chat conversation on first load
  useEffect(() => {
    initConversation(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectScenario = (scenario: ChatScenario) => {
    if (activeScenario?.id === scenario.id) {
      initConversation(null); // deselect -> back to free chat
    } else {
      initConversation(scenario);
    }
  };

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading || !conversationId) return;

      stop();
      stopListening();

      const userMsg: ChatMsg = { role: "user", content: text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);
      setSuggestions([]);
      setIsLoading(true);
      setIsThinking(true);

      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;

      let replyText = "";
      const assistantStreamId = Date.now() + Math.random();

      const appendToAssistantMessage = (delta: string) => {
        replyText += delta;
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.streamId === assistantStreamId);
          if (idx === -1) {
            return [
              ...prev,
              { role: "assistant", content: delta, timestamp: Date.now(), streamId: assistantStreamId },
            ];
          }
          const next = [...prev];
          next[idx] = { ...next[idx], content: next[idx].content + delta };
          return next;
        });
      };

      try {
        await streamChatMessage(
          conversationId,
          text,
          {
            onChunk: (delta) => {
              if (!delta) return;
              setIsThinking(false);
              appendToAssistantMessage(delta);
            },
            onMeta: (meta) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.streamId === assistantStreamId
                    ? { ...m, feedback: meta.feedback, isOffTopic: meta.is_off_topic }
                    : m
                )
              );
              setSuggestions(meta.suggestions || []);
              if (replyText) speak(replyText);
            },
            onError: (message) => {
              setIsThinking(false);
              const errMsg: ChatMsg = {
                role: "assistant",
                content: `エラーが発生しました。😢 ${message || "もう一度試してください。"}`,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, errMsg]);
            },
          },
          controller.signal
        );
      } finally {
        setIsThinking(false);
        setIsLoading(false);
      }
    },
    [isLoading, conversationId, speak, stop, stopListening]
  );

  useEffect(() => {
    handleVoiceResultRef.current = (transcript: string) => {
      if (transcript.trim()) handleSend(transcript);
    };
  }, [handleSend]);

  const handleClearChat = () => {
    initConversation(activeScenario);
  };

  const statusLabel = activeScenario ? activeScenario.title : "Tự do";

  return (
    <div className="chatbot-root">
      {backendStatus === "error" && <div className="status-banner error">⚠️ {statusMsg}</div>}

      <div className="chatbot-layout">
        <ScenarioSidebar
          scenarios={scenarios}
          activeScenarioId={activeScenario?.id ?? null}
          onSelect={handleSelectScenario}
          loading={scenariosLoading}
        />

        <main className="chat-panel">
          <div className="chat-header">
            <div className="chat-avatar-icon">🎓</div>
            <div className="chat-title-group">
              <h1>Kizuna Sensei</h1>
              <p className="chat-subtitle">
                <span className={`status-dot ${backendStatus === "ok" ? "online" : "offline"}`} />
                {isThinking ? "Đang suy nghĩ..." : isSpeaking ? "Đang nói..." : `Đang nghe... (${statusLabel})`}
              </p>
            </div>
            <div className="chat-header-actions">
              <button className="btn-clear" onClick={handleClearChat} title="Bắt đầu lại">
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
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}

            {isThinking && (
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

          {suggestions.length > 0 && (
            <div className="suggestion-chips">
              {suggestions.map((s, i) => (
                <button key={i} type="button" className="suggestion-chip" onClick={() => handleSend(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

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
