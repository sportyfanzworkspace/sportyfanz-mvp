"use client";

import { useState } from "react";
import TriviaManagement from "./trivia-management";
import QuizManagement from "./quiz-management";

type TriviaMode = "single" | "multiple";

export default function TriviaManagementTabs() {
  const [mode, setMode] = useState<TriviaMode>("single");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0d14",
        color: "#f5f6fa",
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <nav
        aria-label="Trivia management format"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          padding: "20px 28px 0",
        }}
      >
        {([
          ["single", "Single Questions"],
          ["multiple", "Multiple Questions"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            style={{
              flex: "1 1 160px",
              maxWidth: 240,
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid #303447",
              background:
                mode === value ? "#f5b82e" : "#222637",
              color:
                mode === value ? "#171717" : "#f5f6fa",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div hidden={mode !== "single"}>
        <TriviaManagement />
      </div>

      <div hidden={mode !== "multiple"}>
        <QuizManagement />
      </div>
    </div>
  );
}
