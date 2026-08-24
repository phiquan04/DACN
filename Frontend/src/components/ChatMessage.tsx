// src/components/ChatMessage.tsx

import React from "react";
import type { ChatMessage as ChatMsg } from "../services/api";
import FeedbackCard from "./FeedbackCard";

interface Props {
  message: ChatMsg;
}

const ChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`chat-message ${isUser ? "user" : "assistant"} ${message.isOffTopic ? "off-topic" : ""}`}>
      {!isUser && (
        <div className="avatar-badge">
          <span>AI</span>
        </div>
      )}
      <div className="bubble-wrap">
        <div className="bubble">
          <p>{message.content}</p>
        </div>
        <span className="timestamp">{time}</span>
        {!isUser && message.feedback && <FeedbackCard text={message.feedback} />}
      </div>
    </div>
  );
};

export default ChatMessage;
