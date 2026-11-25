"use client";

import { useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { apiFetch } from "@/lib/api";
import QuizImageUpload from "./quiz-image-upload";
import {
  TRIVIA_DURATION_LIMITS,
  parseTriviaDuration,
  formatTriviaDuration,
} from "@/lib/trivia-duration";

type Question = {
  key: number;
  id?: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  pointsReward: string;
  imageUrl: string;
  explanation: string;
};

type QuizForm = {
  title: string;
  description: string;
  coverImageUrl: string;
  startsAt: string;
  endsAt: string;
  durationSeconds: string;
  status: "DRAFT" | "ACTIVE";
};

export type EditableQuiz = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  durationSeconds: number | null;
  updatedAt: string;
  questions: {
    id: number;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    pointsReward: number;
    imageUrl: string | null;
    explanation: string | null;
    questionOrder: number;
  }[];
};

type Props = {
  onCreated: () => void;
  editingQuiz?: EditableQuiz;
  onCancel?: () => void;
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "";

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return (
    date.getFullYear() + "-" +
    pad(date.getMonth() + 1) + "-" +
    pad(date.getDate()) + "T" +
    pad(date.getHours()) + ":" +
    pad(date.getMinutes()) + ":" +
    pad(date.getSeconds()) + "." +
    String(date.getMilliseconds()).padStart(3, "0")
  );
}

const emptyForm: QuizForm = {
  title: "",
  description: "",
  coverImageUrl: "",
  startsAt: "",
  endsAt: "",
  durationSeconds: String(
    TRIVIA_DURATION_LIMITS.QUIZ.defaultSeconds
  ),
  status: "DRAFT",
};

function emptyQuestion(key: number): Question {
  return {
    key,
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctOption: "A",
    pointsReward: "10",
    imageUrl: "",
    explanation: "",
  };
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #303447",
  background: "#10121b",
  color: "#f5f6fa",
  fontSize: 14,
  boxSizing: "border-box",
  colorScheme: "dark",
};

const panelStyle: CSSProperties = {
  background: "#141722",
  border: "1px solid #303447",
  borderRadius: 14,
  padding: 20,
  display: "grid",
  gap: 16,
  minWidth: 0,
};

const buttonStyle: CSSProperties = {
  padding: "12px 18px",
  borderRadius: 9,
  border: "none",
  background: "#f5b82e",
  color: "#171717",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  ...buttonStyle,
  background: "#252a3a",
  color: "#f5f6fa",
  border: "1px solid #303447",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 16,
};

export default function QuizCreationForm({
  onCreated,
  editingQuiz,
  onCancel,
}: Props) {
  const isEditing = Boolean(editingQuiz);

  const [form, setForm] = useState<QuizForm>(() =>
    editingQuiz
      ? {
          title: editingQuiz.title,
          description: editingQuiz.description ?? "",
          coverImageUrl: editingQuiz.coverImageUrl ?? "",
          startsAt: toLocalDateTime(editingQuiz.startsAt),
          endsAt: toLocalDateTime(editingQuiz.endsAt),
          durationSeconds:
            editingQuiz.durationSeconds == null
              ? ""
              : String(editingQuiz.durationSeconds),
          status: "DRAFT",
        }
      : { ...emptyForm }
  );

  const [questions, setQuestions] = useState<Question[]>(() =>
    editingQuiz
      ? [...editingQuiz.questions]
          .sort((a, b) => a.questionOrder - b.questionOrder)
          .map((item, index) => ({
            key: index + 1,
            id: item.id,
            question: item.question,
            optionA: item.optionA,
            optionB: item.optionB,
            optionC: item.optionC,
            optionD: item.optionD,
            correctOption:
              item.correctOption as Question["correctOption"],
            pointsReward: String(item.pointsReward),
            imageUrl: item.imageUrl ?? "",
            explanation: item.explanation ?? "",
          }))
      : [emptyQuestion(1), emptyQuestion(2)]
  );

  const nextKey = useRef(questions.length + 1);
  const savingRef = useRef(false);
  const busyRef = useRef<Set<string>>(new Set());
  const failedRef = useRef<Set<string>>(new Set());

  const [uploadCount, setUploadCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formVersion, setFormVersion] = useState(0);

  function updateForm<K extends keyof QuizForm>(
    field: K,
    value: QuizForm[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateQuestion<K extends keyof Question>(
    key: number,
    field: K,
    value: Question[K]
  ) {
    setQuestions((previous) =>
      previous.map((item) =>
        item.key === key
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function setImageBusy(key: string, busy: boolean) {
    if (busy) {
      busyRef.current.add(key);
    } else {
      busyRef.current.delete(key);
    }

    setUploadCount(busyRef.current.size);
  }

  function setImageFailed(key: string, failed: boolean) {
    if (failed) {
      failedRef.current.add(key);
    } else {
      failedRef.current.delete(key);
    }

    setFailedCount(failedRef.current.size);
  }

  function addQuestion() {
    if (savingRef.current || questions.length >= 50) return;

    const key = nextKey.current++;

    setQuestions((previous) =>
      previous.length >= 50
        ? previous
        : [...previous, emptyQuestion(key)]
    );
  }

  function removeQuestion(key: number) {
    if (
      savingRef.current ||
      questions.length <= 2 ||
      busyRef.current.has(String(key))
    ) {
      return;
    }

    const question = questions.find(
      (item) => item.key === key
    );

    if (
      question &&
      (
        question.question.trim() ||
        question.optionA.trim() ||
        question.optionB.trim() ||
        question.optionC.trim() ||
        question.optionD.trim() ||
        question.explanation.trim() ||
        question.imageUrl
      ) &&
      !window.confirm("Remove this question from the quiz?")
    ) {
      return;
    }

    setQuestions((previous) =>
      previous.length <= 2
        ? previous
        : previous.filter((item) => item.key !== key)
    );

    setImageFailed(String(key), false);
  }

  function moveQuestion(key: number, direction: -1 | 1) {
    if (savingRef.current || busyRef.current.size > 0) return;

    setQuestions((previous) => {
      const index = previous.findIndex(
        (item) => item.key === key
      );

      const destination = index + direction;

      if (
        index < 0 ||
        destination < 0 ||
        destination >= previous.length
      ) {
        return previous;
      }

      const reordered = [...previous];

      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];

      return reordered;
    });
  }

  function cancelEditing() {
    if (
      savingRef.current ||
      busyRef.current.size > 0
    ) {
      return;
    }

    if (
      window.confirm("Discard unsaved quiz changes?")
    ) {
      onCancel?.();
    }
  }

  async function saveQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) return;

    setError("");
    setSuccess("");

    if (busyRef.current.size > 0) {
      setError("Please wait for all image uploads to finish.");
      return;
    }

    if (failedRef.current.size > 0) {
      setError("Retry or clear all failed image uploads.");
      return;
    }

    const durationSeconds = parseTriviaDuration(
      form.durationSeconds,
      "QUIZ"
    );

    if (durationSeconds === null) {
      setError(
        "Total quiz time must be a whole number between 30 and 3600 seconds."
      );
      return;
    }

    const title = form.title.trim();
    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);

    if (title.length < 5 || title.length > 150) {
      setError("Quiz title must contain 5 to 150 characters.");
      return;
    }

    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt.getTime() <= startsAt.getTime()
    ) {
      setError("The deadline must be later than the start date.");
      return;
    }

    if (
      form.status === "ACTIVE" &&
      endsAt.getTime() <= Date.now()
    ) {
      setError("An active quiz must have a future deadline.");
      return;
    }

    if (questions.length < 2 || questions.length > 50) {
      setError("A quiz must contain 2 to 50 questions.");
      return;
    }

    for (const [index, item] of questions.entries()) {
      const points = Number(item.pointsReward);

      if (
        item.question.trim().length < 5 ||
        item.question.trim().length > 1000
      ) {
        setError(
          "Question " + (index + 1) +
          ": enter 5 to 1000 characters."
        );
        return;
      }

      if (
        [item.optionA, item.optionB, item.optionC, item.optionD]
          .some((option) =>
            !option.trim() || option.trim().length > 300
          )
      ) {
        setError(
          "Question " + (index + 1) +
          ": all four answer options are required."
        );
        return;
      }

      if (
        !item.pointsReward.trim() ||
        !Number.isSafeInteger(points) ||
        points < 0 ||
        points > 100000
      ) {
        setError(
          "Question " + (index + 1) +
          ": enter valid Fan Points between 0 and 100000."
        );
        return;
      }
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const response = await apiFetch(
        editingQuiz
          ? "/api/admin/trivia/quizzes/" + editingQuiz.id
          : "/api/admin/trivia/quizzes",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description: form.description.trim() || null,
            coverImageUrl: form.coverImageUrl || null,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            durationSeconds,
            status: isEditing ? "DRAFT" : form.status,
            ...(editingQuiz
              ? { expectedUpdatedAt: editingQuiz.updatedAt }
              : {}),
            questions: questions.map((item) => ({
              ...(isEditing && item.id !== undefined
                ? { id: item.id }
                : {}),
              question: item.question.trim(),
              optionA: item.optionA.trim(),
              optionB: item.optionB.trim(),
              optionC: item.optionC.trim(),
              optionD: item.optionD.trim(),
              correctOption: item.correctOption,
              pointsReward: Number(item.pointsReward),
              imageUrl: item.imageUrl || null,
              explanation: item.explanation.trim() || null,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || (
            isEditing
              ? "Unable to update Trivia quiz."
              : "Unable to create Trivia quiz."
          )
        );
      }

      setSuccess(
        isEditing
          ? "Trivia quiz updated successfully."
          : "Trivia quiz created successfully."
      );
      setForm({ ...emptyForm });

      setQuestions([
        emptyQuestion(nextKey.current++),
        emptyQuestion(nextKey.current++),
      ]);

      busyRef.current.clear();
      failedRef.current.clear();

      setUploadCount(0);
      setFailedCount(0);
      setFormVersion((previous) => previous + 1);

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? "Unable to update Trivia quiz."
            : "Unable to create Trivia quiz."
      );
      return;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }

    onCreated();
  }

  return (
    <form
      onSubmit={saveQuiz}
      style={{ display: "grid", gap: 20 }}
    >
      <fieldset
        disabled={saving}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          minWidth: 0,
          display: "grid",
          gap: 20,
        }}
      >
        <section style={panelStyle}>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {isEditing ? "Edit Quiz Information" : "Quiz Information"}
          </h2>

          {isEditing && (
            <small style={{ color: "#f5b82e" }}>
              Changes will be saved as a draft.
              Use Publish Quiz when ready.
            </small>
          )}

          <label>
            Quiz Title *
            <input
              style={inputStyle}
              value={form.title}
              required
              minLength={5}
              maxLength={150}
              onChange={(event) =>
                updateForm("title", event.target.value)
              }
              placeholder="Ultimate Football Challenge"
            />
          </label>

          <label>
            Quiz Description
            <textarea
              style={inputStyle}
              rows={3}
              maxLength={2000}
              value={form.description}
              onChange={(event) =>
                updateForm("description", event.target.value)
              }
              placeholder="Describe the Trivia challenge..."
            />
          </label>

          <QuizImageUpload
            key={formVersion}
            label="Quiz Cover Image"
            value={form.coverImageUrl}
            disabled={saving}
            onChange={(url) =>
              updateForm("coverImageUrl", url)
            }
            onBusyChange={(busy) =>
              setImageBusy("cover", busy)
            }
            onErrorChange={(failed) =>
              setImageFailed("cover", failed)
            }
          />

          <div style={gridStyle}>
            <label>
              Start Date and Time *
              <input
                type="datetime-local"
                step="0.001"
                required
                style={inputStyle}
                value={form.startsAt}
                onChange={(event) =>
                  updateForm("startsAt", event.target.value)
                }
              />
            </label>

            <label>
              Deadline *
              <input
                type="datetime-local"
                step="0.001"
                required
                style={inputStyle}
                value={form.endsAt}
                onChange={(event) =>
                  updateForm("endsAt", event.target.value)
                }
              />
            </label>
          </div>

          <small style={{ color: "#a5acc1" }}>
            Dates and times use your device's local timezone.
          </small>

          <div
            style={{
              display: "grid",
              gap: 12,
              minWidth: 0,
              background: "#10121b",
              border: "1px solid #303447",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 700,
                }}
              >
                Total Quiz Time (seconds) *
              </span>

              <input
                type="number"
                name="durationSeconds"
                min={TRIVIA_DURATION_LIMITS.QUIZ.min}
                max={TRIVIA_DURATION_LIMITS.QUIZ.max}
                step="1"
                required
                disabled={saving}
                value={form.durationSeconds}
                onChange={(event) =>
                  updateForm(
                    "durationSeconds",
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </label>

            {editingQuiz &&
              editingQuiz.durationSeconds == null && (
                <small
                  style={{
                    color: "#f5b82e",
                    lineHeight: 1.5,
                  }}
                >
                  This legacy draft has no countdown.
                  Select a valid total quiz time before
                  saving or publishing.
                </small>
              )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {[60, 180, 300, 600, 900].map((seconds) => {
                const selected =
                  Number(form.durationSeconds) === seconds;

                return (
                  <button
                    key={seconds}
                    type="button"
                    disabled={saving}
                    aria-pressed={selected}
                    onClick={() =>
                      updateForm(
                        "durationSeconds",
                        String(seconds)
                      )
                    }
                    style={{
                      ...secondaryButton,
                      padding: "9px 13px",
                      background: selected
                        ? "#7ccf72"
                        : "#252a3a",
                      color: selected
                        ? "#10121b"
                        : "#f5f6fa",
                      fontSize: 13,
                    }}
                  >
                    {seconds / 60} min
                  </button>
                );
              })}
            </div>

            {parseTriviaDuration(
              form.durationSeconds,
              "QUIZ"
            ) !== null ? (
              <strong
                style={{
                  color: "#7ccf72",
                  fontSize: 14,
                }}
              >
                Total quiz time:{" "}
                {formatTriviaDuration(
                  Number(form.durationSeconds)
                )}
              </strong>
            ) : (
              <small style={{ color: "#ff7777" }}>
                Enter a whole number between
                30 and 3600 seconds.
              </small>
            )}

            <small
              style={{
                color: "#a5acc1",
                lineHeight: 1.6,
              }}
            >
              One continuous countdown applies to all
              questions in this quiz. Moving to another
              question will not restart the countdown.
              Publication dates are configured separately.
            </small>
          </div>

          <label>
            Quiz Status
            <select
              style={inputStyle}
              value={form.status}
              disabled={isEditing || saving}
              onChange={(event) =>
                updateForm(
                  "status",
                  event.target.value as QuizForm["status"]
                )
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active / Scheduled</option>
            </select>
          </label>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>
            Questions ({questions.length})
          </h2>

          <span style={{ color: "#a5acc1", fontSize: 13 }}>
            Minimum 2 - Maximum 50
          </span>
        </div>

        {questions.map((item, index) => (
          <section key={item.key} style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <h3 style={{ color: "#f5b82e", margin: 0 }}>
                Question {index + 1}
              </h3>

              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}>
                <button
                  type="button"
                  style={secondaryButton}
                  disabled={
                    saving || uploadCount > 0 || index === 0
                  }
                  onClick={() => moveQuestion(item.key, -1)}
                >
                  Move Up
                </button>

                <button
                  type="button"
                  style={secondaryButton}
                  disabled={
                    saving ||
                    uploadCount > 0 ||
                    index === questions.length - 1
                  }
                  onClick={() => moveQuestion(item.key, 1)}
                >
                  Move Down
                </button>
              </div>

              <button
                type="button"
                style={secondaryButton}
                disabled={
                  saving ||
                  questions.length <= 2 ||
                  busyRef.current.has(String(item.key))
                }
                onClick={() => removeQuestion(item.key)}
              >
                Remove Question
              </button>
            </div>

            <label>
              Question *
              <textarea
                style={inputStyle}
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                value={item.question}
                onChange={(event) =>
                  updateQuestion(
                    item.key,
                    "question",
                    event.target.value
                  )
                }
                placeholder="Enter your sports Trivia question"
              />
            </label>

            <QuizImageUpload
              label={"Question " + (index + 1) + " Image"}
              value={item.imageUrl}
              disabled={saving}
              onChange={(url) =>
                updateQuestion(item.key, "imageUrl", url)
              }
              onBusyChange={(busy) =>
                setImageBusy(String(item.key), busy)
              }
              onErrorChange={(failed) =>
                setImageFailed(String(item.key), failed)
              }
            />

            <div style={gridStyle}>
              {(["A", "B", "C", "D"] as const).map(
                (option) => {
                  const field = ("option" + option) as
                    "optionA" | "optionB" |
                    "optionC" | "optionD";

                  return (
                    <label key={option}>
                      Option {option} *
                      <input
                        style={inputStyle}
                        required
                        maxLength={300}
                        value={item[field]}
                        onChange={(event) =>
                          updateQuestion(
                            item.key,
                            field,
                            event.target.value
                          )
                        }
                        placeholder={"Option " + option}
                      />
                    </label>
                  );
                }
              )}
            </div>

            <div style={gridStyle}>
              <label>
                Correct Answer *
                <select
                  style={inputStyle}
                  value={item.correctOption}
                  onChange={(event) =>
                    updateQuestion(
                      item.key,
                      "correctOption",
                      event.target.value as
                        Question["correctOption"]
                    )
                  }
                >
                  {(["A", "B", "C", "D"] as const).map(
                    (option) => (
                      <option key={option} value={option}>
                        Option {option}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Fan Points *
                <input
                  type="number"
                  required
                  min={0}
                  max={100000}
                  step={1}
                  style={inputStyle}
                  value={item.pointsReward}
                  onChange={(event) =>
                    updateQuestion(
                      item.key,
                      "pointsReward",
                      event.target.value
                    )
                  }
                />
              </label>
            </div>

            <label>
              Answer Explanation
              <textarea
                style={inputStyle}
                rows={3}
                maxLength={2000}
                value={item.explanation}
                onChange={(event) =>
                  updateQuestion(
                    item.key,
                    "explanation",
                    event.target.value
                  )
                }
                placeholder="Explain why the answer is correct."
              />
            </label>
          </section>
        ))}

        <button
          type="button"
          style={secondaryButton}
          disabled={saving || questions.length >= 50}
          onClick={addQuestion}
        >
          + Add Question
        </button>

        <section style={panelStyle}>
          <strong>Quiz Summary</strong>

          <div>Total Questions: {questions.length}</div>

          <div>
            Maximum Fan Points:{" "}
            {questions.reduce((total, item) => {
              const points = Number(item.pointsReward);

              return total + (
                Number.isSafeInteger(points) &&
                points >= 0 &&
                points <= 100000
                  ? points
                  : 0
              );
            }, 0).toLocaleString()}
          </div>

          {uploadCount > 0 && (
            <p role="status" style={{ color: "#f5b82e" }}>
              {uploadCount} image upload(s) in progress.
            </p>
          )}

          {failedCount > 0 && (
            <p role="alert" style={{ color: "#ff7777" }}>
              Retry or clear {failedCount} failed image upload(s).
            </p>
          )}

          {error && (
            <p role="alert" style={{ color: "#ff7777" }}>
              {error}
            </p>
          )}

          {success && (
            <p role="status" style={{ color: "#7ccf72" }}>
              {success}
            </p>
          )}

          <button
            type="submit"
            style={{
              ...buttonStyle,
              opacity:
                saving || uploadCount > 0 || failedCount > 0
                  ? 0.5
                  : 1,
            }}
            disabled={
              saving ||
              uploadCount > 0 ||
              failedCount > 0
            }
          >
            {saving
              ? "Saving Trivia Quiz..."
              : isEditing
                ? "Save Changes"
                : "Save Trivia Quiz"}
          </button>

          {isEditing && onCancel && (
            <button
              type="button"
              style={secondaryButton}
              disabled={saving || uploadCount > 0}
              onClick={cancelEditing}
            >
              Cancel Editing
            </button>
          )}
        </section>
      </fieldset>
    </form>
  );
}
