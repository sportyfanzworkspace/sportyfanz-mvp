
"use client";

import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";

type TriviaQuestion = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  pointsReward: number;
  status: string;
  scheduleStatus?: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  attemptCount: number;
  correctCount: number;
};

type TriviaForm = {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  pointsReward: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm: TriviaForm = {
  question: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  pointsReward: "10",
  status: "DRAFT",
  startsAt: "",
  endsAt: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #303447",
  background: "#10121b",
  color: "#f5f6fa",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: 9,
  padding: "10px 14px",
  background: "#f5b82e",
  color: "#171717",
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function TriviaManagement() {
  const [questions, setQuestions] = useState<TriviaQuestion[]>([]);
  const [form, setForm] = useState<TriviaForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/trivia", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load Trivia questions.");
      }

      setQuestions(data.questions ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load Trivia questions."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  function exportTriviaToExcel() {
  if (filteredQuestions.length === 0) {
    setNotice("There are no Trivia questions to export.");
    return;
  }

  const rows = filteredQuestions.map((item) => ({
    "Question ID": item.id,
    Question: item.question,
    "Option A": item.optionA,
    "Option B": item.optionB,
    "Option C": item.optionC,
    "Option D": item.optionD,
    "Correct Answer": item.correctOption,
    "Points Reward": item.pointsReward,
    Status: item.status,
    "Schedule Status": item.scheduleStatus ?? item.status,
    "Start Date": item.startsAt ?? "",
    Deadline: item.endsAt ?? "",
    "Created At": item.createdAt,
    Attempts: item.attemptCount,
    "Correct Attempts": item.correctCount,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Trivia Questions");

  XLSX.writeFile(
    workbook,
    `SportyFanz_Trivia_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

  setNotice("Trivia questions exported to Excel successfully.");
  setError("");
 }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateForm<K extends keyof TriviaForm>(
    key: K,
    value: TriviaForm[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/trivia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           ...form,
           pointsReward: Number(form.pointsReward),
           startsAt: form.startsAt
           ? new Date(form.startsAt).toISOString()
           : null,
           endsAt: form.endsAt
           ? new Date(form.endsAt).toISOString()
           : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create the question.");
      }

      setNotice("Trivia question created successfully.");
      setForm(emptyForm);
      setShowForm(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create the question."
      );
    } finally {
      setSaving(false);
    }
  }

   const filteredQuestions = questions.filter((item) => {
   const displayStatus = item.scheduleStatus ?? item.status;
    return filter === "ALL" || displayStatus === filter;
  });

  const activeCount = questions.filter(
     (item) => (item.scheduleStatus ?? item.status) === "ACTIVE"
     ).length;
     
  const attemptCount = questions.reduce(
    (total, item) => total + item.attemptCount,
    0
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0d14",
        color: "#f5f6fa",
        padding: 28,
        fontFamily: "Lato, Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <p style={{ color: "#f5b82e", fontSize: 12, fontWeight: 800 }}>
            SPORTYFANZ ADMIN
          </p>
          <h1 style={{ fontSize: 28, margin: "6px 0" }}>Trivia Management</h1>
          <p style={{ color: "#a5acc1", margin: 0 }}>
            Create questions, manage answers, and monitor fan participation.
          </p>
        </div>

        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            setShowForm((current) => !current);
            setError("");
            setNotice("");
          }}
        >
          {showForm ? "Cancel" : "+ Create Question"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {[
          { label: "Total Questions", value: questions.length },
          { label: "Active Questions", value: activeCount },
          { label: "Total Attempts", value: attemptCount },
        ].map((item) => (
          <section
            key={item.label}
            style={{
              background: "#141722",
              border: "1px solid #303447",
              borderRadius: 14,
              padding: 20,
            }}
          >
            <p style={{ color: "#a5acc1", margin: 0, fontSize: 13 }}>
              {item.label}
            </p>
            <strong style={{ display: "block", fontSize: 28, marginTop: 10 }}>
              {item.value}
            </strong>
          </section>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            background: "#351c23",
            border: "1px solid #75313d",
            padding: 12,
            borderRadius: 9,
            color: "#ffb7c0",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          style={{
            background: "#153329",
            border: "1px solid #28664f",
            padding: 12,
            borderRadius: 9,
            color: "#8ce0b9",
          }}
        >
          {notice}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={createQuestion}
          style={{
            background: "#141722",
            border: "1px solid #303447",
            borderRadius: 14,
            padding: 22,
            marginBottom: 24,
            display: "grid",
            gap: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 19 }}>Create Trivia Question</h2>

          <label>
            <span style={{ display: "block", marginBottom: 7 }}>Question</span>
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={form.question}
              onChange={(event) => updateForm("question", event.target.value)}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
              placeholder="Enter the Trivia question"
            />
          </label>

          {(["A", "B", "C", "D"] as const).map((letter) => {
            const key = `option${letter}` as
              | "optionA"
              | "optionB"
              | "optionC"
              | "optionD";

            return (
              <label key={letter}>
                <span style={{ display: "block", marginBottom: 7 }}>
                  Option {letter}
                </span>
                <input
                  required
                  maxLength={300}
                  value={form[key]}
                  onChange={(event) => updateForm(key, event.target.value)}
                  style={inputStyle}
                  placeholder={`Enter answer ${letter}`}
                />
              </label>
            );
          })}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
            }}
          >
            
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
          <label>
             <span style={{ display: "block", marginBottom: 7 }}>
               Start Date &amp; Time *
            </span>
            <input
               type="datetime-local"
               value={form.startsAt}
               onChange={(event) =>
                 updateForm("startsAt", event.target.value)
               }
             onClick={(event) => {
             const input = event.currentTarget;
              if ("showPicker" in HTMLInputElement.prototype) {
              input.showPicker();
             }
            }}
           style={inputStyle}
           required
         />
         </label>

           <label>
             <span style={{ display: "block", marginBottom: 7 }}>
                Deadline *
             </span>
             <input
                type="datetime-local"
                name="endsAt"
                value={form.endsAt}
                onChange={(event) =>
                  updateForm("endsAt", event.target.value)
                }
               onClick={(event) => {
               const input = event.currentTarget;
                 if ("showPicker" in HTMLInputElement.prototype) {
                 input.showPicker();
                }
               }}
               style={inputStyle}
                required
              />
             </label>
           </div>

            <label>
              <span style={{ display: "block", marginBottom: 7 }}>
                Correct Answer
              </span>
              <select
                value={form.correctOption}
                onChange={(event) =>
                  updateForm("correctOption", event.target.value)
                }
                style={inputStyle}
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </label>

            <label>
              <span style={{ display: "block", marginBottom: 7 }}>
                Points Reward
              </span>
              <input
                type="number"
                min="0"
                max="100000"
                step="1"
                required
                value={form.pointsReward}
                onChange={(event) =>
                  updateForm("pointsReward", event.target.value)
                }
                style={inputStyle}
              />
            </label>

            <label>
              <span style={{ display: "block", marginBottom: 7 }}>Status</span>
              <select
                value={form.status}
                onChange={(event) => updateForm("status", event.target.value)}
                style={inputStyle}
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" disabled={saving} style={buttonStyle}>
              {saving ? "Saving..." : "Save Question"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              style={{
                ...buttonStyle,
                background: "#252a3a",
                color: "#f5f6fa",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section
        style={{
          background: "#141722",
          border: "1px solid #303447",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <div
         style={{
         display: "flex",
         justifyContent: "space-between",
         alignItems: "center",
         flexWrap: "wrap",
         gap: 12,
         marginBottom: 18,
       }}
      >
     <h2 style={{ fontSize: 19, margin: 0 }}>Questions</h2>

     <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button
         type="button"
         onClick={exportTriviaToExcel}
         style={{
            ...buttonStyle,
            background: "#222637",
            color: "#f5f6fa",
           border: "1px solid #303447",
         }}
        >
         Export to Excel
       </button>

        <select
          aria-label="Filter Trivia questions by status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          style={{ ...inputStyle, width: "auto", minWidth: 160 }}
        >
           <option value="ALL">All statuses</option>
           <option value="DRAFT">Draft</option>
           <option value="ACTIVE">Active</option>
           <option value="SCHEDULED">Scheduled</option>
           <option value="CLOSED">Closed</option>
        </select>
       </div>
      </div>

        {loading ? (
          <p style={{ color: "#a5acc1" }}>Loading Trivia questions...</p>
        ) : filteredQuestions.length === 0 ? (
          <p style={{ color: "#a5acc1" }}>
            No questions found for this filter.
          </p>
        ) : (
          
       <div style={{ display: "grid", gap: 12 }}>
         {filteredQuestions.map((item) => {
       const displayStatus = item.scheduleStatus ?? item.status;

      return (
       <article
        key={item.id}
        style={{
          border: "1px solid #303447",
          borderRadius: 12,
          padding: 16,
          background: "#10121b",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <strong>{item.question}</strong>

            <p style={{ color: "#a5acc1", fontSize: 13 }}>
              A. {item.optionA} · B. {item.optionB}
              <br />
              C. {item.optionC} · D. {item.optionD}
            </p>

            <p style={{ color: "#a5acc1", fontSize: 12 }}>
              Created {formatDate(item.createdAt)}
            </p>

            <p style={{ color: "#a5acc1", fontSize: 12 }}>
              Starts: {item.startsAt ? formatDate(item.startsAt) : "Immediately"}
              <br />
              Deadline: {item.endsAt ? formatDate(item.endsAt) : "No deadline"}
            </p>
          </div>

          <span
            style={{
              color:
                displayStatus === "ACTIVE"
                  ? "#58d6a1"
                  : displayStatus === "DRAFT"
                    ? "#f5b82e"
                    : displayStatus === "SCHEDULED"
                      ? "#80b8ff"
                      : "#a5acc1",
              fontSize: 12,
              fontWeight: 800,
            }}
           >
            {displayStatus}
          </span>
        </div>

          <div
            style={{
              display: "flex",
              gap: 20,
              flexWrap: "wrap",
              color: "#c7ccda",
              fontSize: 13,
            }}
          >
            <span>{item.pointsReward} points</span>
            <span>{item.attemptCount} attempts</span>
            <span>{item.correctCount} correct</span>
          </div>
            </article>
            );
          })}
        </div>
        )}
      </section>
      <div style={{ marginTop: 24 }}>
        <a
          href="/admin/dashboard"
          style={{ color: "#f5b82e", textDecoration: "none" }}
        >
          ← Back to Admin Dashboard
        </a>
      </div>
    </main>
  );
}
