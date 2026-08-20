// src/components/ScenarioSidebar.tsx

import React, { useMemo, useState } from "react";
import type { ChatScenario } from "../services/api";

interface Props {
  scenarios: ChatScenario[];
  activeScenarioId: number | null;
  onSelect: (scenario: ChatScenario) => void;
  loading: boolean;
}

const ScenarioSidebar: React.FC<Props> = ({ scenarios, activeScenarioId, onSelect, loading }) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scenarios;
    return scenarios.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
    );
  }, [scenarios, query]);

  return (
    <aside className="scenario-sidebar">
      <div className="scenario-sidebar-header">
        <h2>Tình huống hội thoại</h2>
        <p>Chọn bối cảnh để luyện tập</p>
        <div className="scenario-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="16" height="16">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="m21 21-4.3-4.3" strokeWidth="2" />
          </svg>
          <input
            type="text"
            placeholder="Tìm tình huống..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="scenario-list">
        {loading && <div className="scenario-empty">Đang tải...</div>}
        {!loading && filtered.length === 0 && (
          <div className="scenario-empty">Không tìm thấy tình huống phù hợp.</div>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`scenario-card ${activeScenarioId === s.id ? "active" : ""}`}
            onClick={() => onSelect(s)}
          >
            <span className="scenario-card-icon">{s.icon || "💬"}</span>
            <span className="scenario-card-body">
              <span className="scenario-card-top">
                <span className="scenario-card-title">{s.title}</span>
                {s.level && <span className="scenario-card-badge">{s.level}</span>}
              </span>
              {s.description && <span className="scenario-card-desc">{s.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
};

export default ScenarioSidebar;
