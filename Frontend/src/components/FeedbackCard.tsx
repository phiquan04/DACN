// src/components/FeedbackCard.tsx

import React from "react";

interface Props {
  text: string;
}

const FeedbackCard: React.FC<Props> = ({ text }) => (
  <div className="feedback-card">
    <div className="feedback-card-title">
      <span>📍</span>
      <span>Nhận xét từ Kizuna</span>
    </div>
    <div className="feedback-card-body">{text}</div>
  </div>
);

export default FeedbackCard;
