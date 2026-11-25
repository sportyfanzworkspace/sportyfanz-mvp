"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { apiFetch } from "@/lib/api";
import QuizCreationForm from "./quiz-creation-form";
import * as XLSX from "xlsx";
import {
  parseTriviaDuration,
  formatTriviaDuration,
} from "@/lib/trivia-duration";

type QuizStatus =
  "DRAFT" | "ACTIVE" | "SCHEDULED" | "CLOSED";

type QuizQuestion = {
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
  attemptCount: number;
};

type Quiz = {
  id: number;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  scheduleStatus: QuizStatus;
  startsAt: string | null;
  endsAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  attemptCount: number;
  correctCount: number;
  questions: QuizQuestion[];
};

function hasValidQuizDuration(quiz: Quiz): boolean {
  return (
    typeof quiz.durationSeconds === "number" &&
    parseTriviaDuration(
      String(quiz.durationSeconds),
      "QUIZ"
    ) !== null
  );
}

const panelStyle: CSSProperties = {
  background: "#141722",
  border: "1px solid #303447",
  borderRadius: 14,
  padding: 18,
  minWidth: 0,
};

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: 9,
  padding: "12px 16px",
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

const inputStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #303447",
  background: "#10121b",
  color: "#f5f6fa",
  fontSize: 14,
  boxSizing: "border-box",
  minWidth: 0,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
  gap: 14,
};

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Invalid date"
    : date.toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

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

function effectiveStatus(
  quiz: Quiz,
  now: number
): QuizStatus {
  if (quiz.status !== "ACTIVE") return quiz.status;

  if (
    quiz.endsAt &&
    new Date(quiz.endsAt).getTime() <= now
  ) {
    return "CLOSED";
  }

  if (
    quiz.startsAt &&
    new Date(quiz.startsAt).getTime() > now
  ) {
    return "SCHEDULED";
  }

  return "ACTIVE";
}

export default function QuizManagement() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [editingQuiz, setEditingQuiz] =
    useState<Quiz | null>(null);

  const editFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingQuiz) {
      editFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [editingQuiz]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | QuizStatus
  >("ALL");
  const [expandedId, setExpandedId] = useState<
    number | null
  >(null);
  const [now, setNow] = useState(Date.now);

  const [closeTarget, setCloseTarget] =
    useState<Quiz | null>(null);

  const [closingId, setClosingId] =
    useState<number | null>(null);

  const [closeError, setCloseError] = useState("");

  const closingRef = useRef(false);
  const closeDialogRef = useRef<HTMLDialogElement>(null);

  const [publishTarget, setPublishTarget] =
    useState<Quiz | null>(null);

  const [publishingId, setPublishingId] =
    useState<number | null>(null);

  const [publishError, setPublishError] = useState("");

  const [scheduleTarget, setScheduleTarget] =
    useState<Quiz | null>(null);

  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleSaving, setScheduleSaving] = useState(false);

  const scheduleSavingRef = useRef(false);
  const scheduleDialogRef =
    useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = scheduleDialogRef.current;

    if (scheduleTarget && dialog && !dialog.open) {
      dialog.showModal();
    }

    if (!scheduleTarget && dialog?.open) {
      dialog.close();
    }
  }, [scheduleTarget]);

  const publishingRef = useRef(false);
  const publishDialogRef =
    useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = publishDialogRef.current;

    if (publishTarget && dialog && !dialog.open) {
      dialog.showModal();
    }

    if (!publishTarget && dialog?.open) {
      dialog.close();
    }
  }, [publishTarget]);


  useEffect(() => {
    const dialog = closeDialogRef.current;

    if (closeTarget && dialog && !dialog.open) {
      dialog.showModal();
    }

    if (!closeTarget && dialog?.open) {
      dialog.close();
    }
  }, [closeTarget]);


  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiFetch(
        "/api/admin/trivia/quizzes",
        { cache: "no-store" }
      );

      const data = await response.json();

      if (
        !response.ok ||
        data.success !== true ||
        !Array.isArray(data.quizzes)
      ) {
        throw new Error(
          data.error || "Unable to load Trivia quizzes."
        );
      }

      setQuizzes(data.quizzes);
      setNow(Date.now());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Trivia quizzes."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now()),
      30000
    );

    return () => window.clearInterval(timer);
  }, []);

  const statistics = [
    ["Total Quizzes", quizzes.length],
    [
      "Active Quizzes",
      quizzes.filter(
        (quiz) => effectiveStatus(quiz, now) === "ACTIVE"
      ).length,
    ],
    [
      "Scheduled Quizzes",
      quizzes.filter(
        (quiz) => effectiveStatus(quiz, now) === "SCHEDULED"
      ).length,
    ],
    [
      "Total Questions",
      quizzes.reduce(
        (total, quiz) => total + quiz.questionCount,
        0
      ),
    ],
    [
      "Draft Quizzes",
      quizzes.filter(
        (quiz) => quiz.status === "DRAFT"
      ).length,
    ],
    [
      "Closed Quizzes",
      quizzes.filter(
        (quiz) => effectiveStatus(quiz, now) === "CLOSED"
      ).length,
    ],
  ] as const;

  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesStatus =
      filter === "ALL" ||
      effectiveStatus(quiz, now) === filter;

    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      quiz.title.toLowerCase().includes(query) ||
      (quiz.description || "").toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

  function exportQuizzesToExcel() {
    if (loading || error) return;

    if (filteredQuizzes.length === 0) {
      setNotice("There are no Trivia quizzes to export.");
      return;
    }

    try {
      const exportTime = Date.now();

      const summaryRows = filteredQuizzes.map((quiz) => ({
        "Quiz ID": quiz.id,
        "Quiz Title": quiz.title,
        Description: quiz.description ?? "",
        Status: quiz.status,
        "Schedule Status": effectiveStatus(quiz, exportTime),
        "Start Date (UTC)": quiz.startsAt ?? "",
        "Deadline (UTC)": quiz.endsAt ?? "",
        "Duration (Seconds)": quiz.durationSeconds ?? "",
        "Total Quiz Time": formatTriviaDuration(
          quiz.durationSeconds
        ),
        "Question Count": quiz.questions.length,
        "Maximum Fan Points": quiz.questions.reduce(
          (total, question) =>
            total + question.pointsReward,
          0
        ),
        "Total Attempts": quiz.attemptCount,
        "Correct Answers": quiz.correctCount,
        "Cover Image URL": quiz.coverImageUrl ?? "",
        "Created At (UTC)": quiz.createdAt,
        "Updated At (UTC)": quiz.updatedAt,
      }));

      const questionRows = filteredQuizzes.flatMap(
        (quiz) =>
          [...quiz.questions]
            .sort(
              (a, b) =>
                a.questionOrder - b.questionOrder
            )
            .map((question) => ({
              "Quiz ID": quiz.id,
              "Quiz Title": quiz.title,
              "Question ID": question.id,
              "Question Order": question.questionOrder,
              Question: question.question,
              "Option A": question.optionA,
              "Option B": question.optionB,
              "Option C": question.optionC,
              "Option D": question.optionD,
              "Correct Option": question.correctOption,
              "Correct Answer":
                question.correctOption === "A"
                  ? question.optionA
                  : question.correctOption === "B"
                    ? question.optionB
                    : question.correctOption === "C"
                      ? question.optionC
                      : question.correctOption === "D"
                        ? question.optionD
                        : "",
              "Fan Points": question.pointsReward,
              Explanation: question.explanation ?? "",
              "Image URL": question.imageUrl ?? "",
              Attempts: question.attemptCount,
            }))
      );

      const performanceRows = filteredQuizzes.map(
        (quiz) => ({
          "Quiz ID": quiz.id,
          "Quiz Title": quiz.title,
          "Schedule Status": effectiveStatus(
            quiz,
            exportTime
          ),
          "Question Count": quiz.questions.length,
          "Total Question Attempts": quiz.attemptCount,
          "Correct Answers": quiz.correctCount,
          "Incorrect Answers": Math.max(
            0,
            quiz.attemptCount - quiz.correctCount
          ),
          Accuracy:
            quiz.attemptCount > 0
              ? quiz.correctCount / quiz.attemptCount
              : null,
        })
      );

      const workbook = XLSX.utils.book_new();

      const summarySheet =
        XLSX.utils.json_to_sheet(summaryRows);

      const questionSheet =
        XLSX.utils.json_to_sheet(questionRows, {
          header: [
            "Quiz ID",
            "Quiz Title",
            "Question ID",
            "Question Order",
            "Question",
            "Option A",
            "Option B",
            "Option C",
            "Option D",
            "Correct Option",
            "Correct Answer",
            "Fan Points",
            "Explanation",
            "Image URL",
            "Attempts",
          ],
        });

      const performanceSheet =
        XLSX.utils.json_to_sheet(performanceRows);

      summarySheet["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 60 },
        { wch: 14 },
        { wch: 18 },
        { wch: 28 },
        { wch: 28 },
        { wch: 22 },
        { wch: 24 },
        { wch: 18 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 60 },
        { wch: 28 },
        { wch: 28 },
      ];

      questionSheet["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 14 },
        { wch: 18 },
        { wch: 65 },
        { wch: 35 },
        { wch: 35 },
        { wch: 35 },
        { wch: 35 },
        { wch: 18 },
        { wch: 40 },
        { wch: 14 },
        { wch: 65 },
        { wch: 60 },
        { wch: 14 },
      ];

      performanceSheet["!cols"] = [
        { wch: 12 },
        { wch: 40 },
        { wch: 20 },
        { wch: 18 },
        { wch: 26 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
      ];

      // Store accuracy as a numeric Excel percentage.
      for (
        let index = 0;
        index < performanceRows.length;
        index++
      ) {
        const address = XLSX.utils.encode_cell({
          r: index + 1,
          c: 7,
        });

        const cell = performanceSheet[address];

        if (cell && cell.t === "n") {
          cell.z = "0.00%";
        }
      }

      for (const sheet of [
        summarySheet,
        questionSheet,
        performanceSheet,
      ]) {
        if (sheet["!ref"]) {
          sheet["!autofilter"] = {
            ref: sheet["!ref"],
          };
        }
      }

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Quiz Summary"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        questionSheet,
        "Quiz Questions"
      );

      XLSX.utils.book_append_sheet(
        workbook,
        performanceSheet,
        "Performance Summary"
      );

      const date = new Date(exportTime)
        .toISOString()
        .slice(0, 10);

      XLSX.writeFile(
        workbook,
        "SportyFanz_Multiple_Trivia_" + date + ".xlsx"
      );

      setNotice(
        filteredQuizzes.length +
          " Trivia quiz(es) exported to Excel successfully."
      );

    } catch (err) {
      setNotice("");
      setError(
        err instanceof Error
          ? err.message
          : "Unable to export Trivia quizzes."
      );
    }
  }

  function requestClose(quiz: Quiz) {
    if (
      editingQuiz !== null ||
      closingRef.current ||
      publishingRef.current ||
      scheduleSavingRef.current ||
      quiz.status !== "ACTIVE"
    ) {
      return;
    }

    setCloseError("");
    setNotice("");
    setCloseTarget(quiz);
  }

  function cancelClose() {
    if (closingRef.current) return;

    setCloseTarget(null);
    setCloseError("");
  }

  async function confirmClose() {
    if (
      editingQuiz !== null ||
      !closeTarget ||
      closingRef.current ||
      publishingRef.current ||
      scheduleSavingRef.current
    ) return;

    const quizId = closeTarget.id;

    closingRef.current = true;
    setClosingId(quizId);
    setCloseError("");

    try {
      const response = await apiFetch(
        "/api/admin/trivia/quizzes/" + quizId + "/close",
        {
          method: "PATCH",
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || "Unable to close Trivia quiz."
        );
      }

      setQuizzes((previous) =>
        previous.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                status: "CLOSED",
                scheduleStatus: "CLOSED",
              }
            : quiz
        )
      );

      setCloseTarget(null);
      setNotice("Trivia quiz closed successfully.");

      await loadQuizzes();
    } catch (err) {
      setCloseError(
        err instanceof Error
          ? err.message
          : "Unable to close Trivia quiz."
      );
    } finally {
      closingRef.current = false;
      setClosingId(null);
    }
  }

  function requestPublish(quiz: Quiz) {
    if (
      editingQuiz !== null ||
      publishingRef.current ||
      closingRef.current ||
      scheduleSavingRef.current ||
      quiz.status !== "DRAFT"
    ) {
      return;
    }

    setPublishError("");
    setNotice("");
    setPublishTarget(quiz);
  }

  function cancelPublish() {
    if (publishingRef.current) return;

    setPublishTarget(null);
    setPublishError("");
  }

  async function confirmPublish() {
    if (
      editingQuiz !== null ||
      !publishTarget ||
      publishingRef.current ||
      closingRef.current ||
      scheduleSavingRef.current
    ) {
      return;
    }

    if (!hasValidQuizDuration(publishTarget)) {
      setPublishError(
        "Configure a valid total quiz time using Edit Quiz before publishing."
      );
      return;
    }

    const quizId = publishTarget.id;
    const expectedUpdatedAt = publishTarget.updatedAt;

    if (
      typeof expectedUpdatedAt !== "string" ||
      !Number.isFinite(
        new Date(expectedUpdatedAt).getTime()
      )
    ) {
      setPublishError(
        "Unable to identify the quiz version. Cancel, refresh and try again."
      );
      return;
    }

    const startTime = publishTarget.startsAt
      ? new Date(publishTarget.startsAt).getTime()
      : NaN;

    const endTime = publishTarget.endsAt
      ? new Date(publishTarget.endsAt).getTime()
      : NaN;

    setPublishError("");

    if (
      !Number.isFinite(startTime) ||
      !Number.isFinite(endTime) ||
      endTime <= startTime ||
      endTime <= Date.now()
    ) {
      setPublishError(
        "This quiz requires a valid schedule with a future deadline."
      );
      return;
    }

    publishingRef.current = true;
    setPublishingId(quizId);

    try {
      const response = await apiFetch(
        "/api/admin/trivia/quizzes/" + quizId + "/publish",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expectedUpdatedAt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || "Unable to publish Trivia quiz."
        );
      }

      const updatedAt = data.quiz?.updatedAt;

      if (
        typeof updatedAt !== "string" ||
        !Number.isFinite(new Date(updatedAt).getTime())
      ) {
        setPublishTarget(null);
        await loadQuizzes();
        setNotice(
          "Quiz publication succeeded. Verify the refreshed quiz status."
        );
        return;
      }

      const scheduleStatus: QuizStatus =
        data.scheduleStatus === "SCHEDULED"
          ? "SCHEDULED"
          : "ACTIVE";

      setQuizzes((previous) =>
        previous.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                status: "ACTIVE",
                scheduleStatus,
                updatedAt,
              }
            : quiz
        )
      );

      setNow(Date.now());
      setPublishTarget(null);
      setFilter("ALL");

      setNotice(
        scheduleStatus === "SCHEDULED"
          ? "Trivia quiz published and scheduled successfully."
          : "Trivia quiz published successfully."
      );

      await loadQuizzes();

    } catch (err) {
      setPublishError(
        err instanceof Error
          ? err.message
          : "Unable to publish Trivia quiz."
      );
    } finally {
      publishingRef.current = false;
      setPublishingId(null);
    }
  }

  function requestSchedule(quiz: Quiz) {
    if (
      editingQuiz !== null ||
      scheduleSavingRef.current ||
      publishingRef.current ||
      closingRef.current ||
      quiz.status !== "DRAFT"
    ) {
      return;
    }

    setNotice("");
    setScheduleError("");
    setScheduleStart(toLocalDateTime(quiz.startsAt));
    setScheduleEnd(toLocalDateTime(quiz.endsAt));
    setScheduleTarget(quiz);
  }

  function cancelSchedule() {
    if (scheduleSavingRef.current) return;

    setScheduleTarget(null);
    setScheduleError("");
  }

  async function confirmSchedule() {
    if (
      editingQuiz !== null ||
      !scheduleTarget ||
      scheduleSavingRef.current ||
      publishingRef.current ||
      closingRef.current
    ) {
      return;
    }

    setScheduleError("");

    const startsAt = new Date(scheduleStart);
    const endsAt = new Date(scheduleEnd);

    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt.getTime() <= startsAt.getTime() ||
      endsAt.getTime() <= Date.now()
    ) {
      setScheduleError(
        "Provide a valid start date and a later, future deadline."
      );
      return;
    }

    const quizId = scheduleTarget.id;
    const expectedUpdatedAt = scheduleTarget.updatedAt;

    if (
      typeof expectedUpdatedAt !== "string" ||
      !Number.isFinite(
        new Date(expectedUpdatedAt).getTime()
      )
    ) {
      setScheduleError(
        "Unable to identify the quiz version. Cancel, refresh and try again."
      );
      return;
    }

    scheduleSavingRef.current = true;
    setScheduleSaving(true);

    try {
      const response = await apiFetch(
        "/api/admin/trivia/quizzes/" + quizId + "/schedule",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            expectedUpdatedAt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.success !== true) {
        throw new Error(
          data.error || "Unable to update quiz schedule."
        );
      }

      const updatedAt = data.quiz?.updatedAt;

      if (
        typeof updatedAt !== "string" ||
        !Number.isFinite(new Date(updatedAt).getTime())
      ) {
        setScheduleTarget(null);
        await loadQuizzes();
        setNotice(
          "Schedule update succeeded. Verify the refreshed quiz schedule."
        );
        return;
      }

      setQuizzes((previous) =>
        previous.map((quiz) =>
          quiz.id === quizId
            ? {
                ...quiz,
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
                updatedAt,
              }
            : quiz
        )
      );

      setScheduleTarget(null);
      setNotice("Trivia quiz schedule updated successfully.");
      setNow(Date.now());

      await loadQuizzes();

    } catch (err) {
      setScheduleError(
        err instanceof Error
          ? err.message
          : "Unable to update quiz schedule."
      );
    } finally {
      scheduleSavingRef.current = false;
      setScheduleSaving(false);
    }
  }

  function requestEdit(quiz: Quiz) {
    if (
      editingQuiz ||
      showForm ||
      loading ||
      closingRef.current ||
      publishingRef.current ||
      scheduleSavingRef.current ||
      closeTarget ||
      publishTarget ||
      scheduleTarget ||
      quiz.status !== "DRAFT" ||
      quiz.attemptCount > 0 ||
      quiz.questions.some(
        (question) => question.attemptCount > 0
      )
    ) {
      return;
    }

    if (
      typeof quiz.updatedAt !== "string" ||
      !Number.isFinite(
        new Date(quiz.updatedAt).getTime()
      )
    ) {
      setError(
        "Unable to identify the quiz version. Refresh and try again."
      );
      return;
    }

    setNotice("");
    setError("");
    setEditingQuiz(quiz);
  }

  function handleEdited() {
    setEditingQuiz(null);
    setNotice("Trivia quiz updated successfully.");
    setFilter("ALL");
    setSearch("");
    void loadQuizzes();
  }

  function handleEditCancelled() {
    setEditingQuiz(null);
    setNotice("");
  }

  function handleCreated() {
    setShowForm(false);
    setNotice("Trivia quiz created successfully.");
    setFilter("ALL");
    setSearch("");
    void loadQuizzes();
  }

  return (
    <section
      style={{
        padding: "28px clamp(14px, 3vw, 28px)",
        display: "grid",
        gap: 20,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <p
            style={{
              color: "#f5b82e",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            SPORTYFANZ ADMIN
          </p>

          <h1 style={{ fontSize: 28, margin: "8px 0" }}>
            Multiple Question Trivia
          </h1>

          <p style={{ color: "#a5acc1" }}>
            Create and manage sports quizzes.
          </p>
        </div>

        <button
          type="button"
          style={buttonStyle}
          disabled={
            editingQuiz !== null ||
            closingId !== null ||
            publishingId !== null ||
            scheduleSaving ||
            closeTarget !== null ||
            publishTarget !== null ||
            scheduleTarget !== null
          }
          onClick={() => {
            if (editingQuiz) return;

            setNotice("");
            setShowForm((previous) => !previous);
          }}
        >
          {showForm ? "Hide Creation Form" : "+ Create Quiz"}
        </button>
      </div>

      <div style={gridStyle}>
        {statistics.map(([label, value]) => (
          <div key={label} style={panelStyle}>
            <div style={{ color: "#a5acc1", fontSize: 13 }}>
              {label}
            </div>

            <div
              style={{
                color: "#f5b82e",
                fontSize: 28,
                fontWeight: 800,
                marginTop: 8,
              }}
            >
              {loading || error ? "-" : value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div role="status" style={{ color: "#7ccf72" }}>
          {notice}
        </div>
      )}

      <div hidden={!showForm || editingQuiz !== null}>
        <QuizCreationForm onCreated={handleCreated} />
      </div>

      {editingQuiz && (
        <div
          ref={editFormRef}
          style={{
            display: "grid",
            gap: 16,
            scrollMarginTop: 90,
            minWidth: 0,
          }}
        >
          <div style={panelStyle}>
            <small style={{ color: "#f5b82e" }}>
              EDITING DRAFT QUIZ
            </small>

            <h2 style={{ margin: "8px 0" }}>
              {editingQuiz.title}
            </h2>

            <p style={{ color: "#a5acc1" }}>
              Update the quiz information and questions.
              Your changes will remain in draft status
              until you publish the quiz.
            </p>
          </div>

          <QuizCreationForm
            key={editingQuiz.id + ":" + editingQuiz.updatedAt}
            editingQuiz={editingQuiz}
            onCreated={handleEdited}
            onCancel={handleEditCancelled}
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <input
          aria-label="Search Trivia quizzes"
          placeholder="Search quizzes..."
          style={{
            ...inputStyle,
            flex: "1 1 200px",
          }}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <select
          aria-label="Filter quizzes by status"
          style={inputStyle}
          value={filter}
          onChange={(event) =>
            setFilter(
              event.target.value as "ALL" | QuizStatus
            )
          }
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="DRAFT">Draft</option>
          <option value="CLOSED">Closed</option>
        </select>

        <button
          type="button"
          style={secondaryButton}
          disabled={loading}
          onClick={() => void loadQuizzes()}
        >
          Refresh
        </button>

        <button
          type="button"
          disabled={
            loading ||
            Boolean(error) ||
            filteredQuizzes.length === 0 ||
            editingQuiz !== null ||
            showForm ||
            closingId !== null ||
            publishingId !== null ||
            scheduleSaving
          }
          onClick={exportQuizzesToExcel}
          style={{
            ...buttonStyle,
            background: "#7ccf72",
            color: "#171717",
          }}
        >
          Export Excel
        </button>
      </div>

      {error && (
        <div role="alert" style={{ color: "#ff7777" }}>
          {error}
        </div>
      )}

      {loading ? (
        <p role="status">Loading Trivia quizzes...</p>
      ) : error ? null : filteredQuizzes.length === 0 ? (
        <div style={panelStyle}>
          No Trivia quizzes found.
        </div>
      ) : (
        filteredQuizzes.map((quiz) => {
          const status = effectiveStatus(quiz, now);

          const maximumPoints = quiz.questions.reduce(
            (total, question) =>
              total + question.pointsReward,
            0
          );

          return (
            <article key={quiz.id} style={panelStyle}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                {quiz.coverImageUrl && (
                  <img
                    src={quiz.coverImageUrl}
                    alt={quiz.title}
                    style={{
                      width: 140,
                      maxWidth: "100%",
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 10,
                    }}
                  />
                )}

                <div
                  style={{
                    flex: "1 1 180px",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
                    {quiz.title}
                  </h2>

                  {quiz.description && (
                    <p style={{ color: "#a5acc1" }}>
                      {quiz.description}
                    </p>
                  )}

                  <p style={{ color: "#a5acc1", fontSize: 13 }}>
                    {quiz.questionCount} Questions
                    {" | "}
                    {maximumPoints.toLocaleString()} Fan Points
                  </p>

                  <p
                    style={{
                      color: hasValidQuizDuration(quiz)
                        ? "#7ccf72"
                        : "#a5acc1",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    Total quiz time:{" "}
                    {formatTriviaDuration(
                      quiz.durationSeconds
                    )}
                  </p>

                  {quiz.status === "DRAFT" &&
                    !hasValidQuizDuration(quiz) && (
                      <small
                        style={{
                          color: "#f5b82e",
                          lineHeight: 1.5,
                        }}
                      >
                        Configure a valid countdown using
                        Edit Quiz before publishing.
                      </small>
                    )}
                </div>

                <strong
                  style={{
                    fontSize: 12,
                    color:
                      status === "ACTIVE"
                        ? "#7ccf72"
                        : status === "SCHEDULED"
                          ? "#f5b82e"
                          : status === "CLOSED"
                            ? "#ff7777"
                            : "#a5acc1",
                  }}
                >
                  {status}
                </strong>
              </div>

              <div
                style={{
                  ...gridStyle,
                  fontSize: 13,
                  color: "#a5acc1",
                  marginTop: 16,
                }}
              >
                <div>Starts: {formatDate(quiz.startsAt)}</div>
                <div>Deadline: {formatDate(quiz.endsAt)}</div>
                <div>Attempts: {quiz.attemptCount}</div>
                <div>Correct Answers: {quiz.correctCount}</div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  style={secondaryButton}
                  aria-expanded={expandedId === quiz.id}
                  onClick={() =>
                    setExpandedId((previous) =>
                      previous === quiz.id ? null : quiz.id
                    )
                  }
                >
                  {expandedId === quiz.id
                    ? "Hide Details"
                    : "View Details"}
                </button>

                {quiz.status === "DRAFT" &&
                  quiz.attemptCount === 0 &&
                  quiz.questions.every(
                    (question) => question.attemptCount === 0
                  ) && (
                  <button
                    type="button"
                    disabled={
                      editingQuiz !== null ||
                      showForm ||
                      scheduleSaving ||
                      publishingId !== null ||
                      closingId !== null ||
                      loading
                    }
                    onClick={() => requestEdit(quiz)}
                    style={buttonStyle}
                  >
                    Edit Quiz
                  </button>
                )}

                {quiz.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={
                      editingQuiz !== null ||
                      scheduleSaving ||
                      publishingId !== null ||
                      closingId !== null ||
                      loading
                    }
                    onClick={() => requestSchedule(quiz)}
                    style={{
                      ...secondaryButton,
                      color: "#f5b82e",
                    }}
                  >
                    Edit Schedule
                  </button>
                )}

                {quiz.status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={
                      editingQuiz !== null ||
                      publishingId !== null ||
                      closingId !== null ||
                      scheduleSaving ||
                      loading
                    }
                    onClick={() => requestPublish(quiz)}
                    style={{
                      ...buttonStyle,
                      background: "#7ccf72",
                      color: "#171717",
                    }}
                  >
                    Publish Quiz
                  </button>
                )}

                {quiz.status === "ACTIVE" && (
                  <button
                    type="button"
                    disabled={
                      editingQuiz !== null ||
                      closingId !== null ||
                      publishingId !== null ||
                      scheduleSaving ||
                      loading
                    }
                    onClick={() => requestClose(quiz)}
                    style={{
                      ...secondaryButton,
                      color: "#ff7777",
                      border: "1px solid #7f3030",
                    }}
                  >
                    Close Quiz
                  </button>
                )}
              </div>

              {expandedId === quiz.id && (
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                    marginTop: 20,
                  }}
                >
                  {quiz.questions.map((question, index) => (
                    <div
                      key={question.id}
                      style={{
                        ...panelStyle,
                        background: "#10121b",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <strong style={{ color: "#f5b82e" }}>
                        Question {index + 1}
                      </strong>

                      <p>{question.question}</p>

                      {question.imageUrl && (
                        <img
                          src={question.imageUrl}
                          alt={"Question " + (index + 1)}
                          style={{
                            width: "100%",
                            maxHeight: 220,
                            objectFit: "contain",
                            borderRadius: 10,
                          }}
                        />
                      )}

                      {([
                        ["A", question.optionA],
                        ["B", question.optionB],
                        ["C", question.optionC],
                        ["D", question.optionD],
                      ] as const).map(([option, answer]) => (
                        <p
                          key={option}
                          style={{
                            color:
                              question.correctOption === option
                                ? "#7ccf72"
                                : "#a5acc1",
                          }}
                        >
                          {option}. {answer}
                          {question.correctOption === option
                            ? " (Correct Answer)"
                            : ""}
                        </p>
                      ))}

                      <p>
                        Fan Points: {question.pointsReward}
                      </p>

                      {question.explanation && (
                        <p>
                          Explanation: {question.explanation}
                        </p>
                      )}

                      <small style={{ color: "#a5acc1" }}>
                        Attempts: {question.attemptCount}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })
      )}

      <dialog
        ref={closeDialogRef}
        aria-labelledby="close-quiz-title"
        aria-describedby="close-quiz-description"
        onCancel={(event) => {
          event.preventDefault();
          cancelClose();
        }}
        style={{
          width: "min(460px, calc(100% - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "auto",
          padding: 24,
          background: "#141722",
          color: "#f5f6fa",
          border: "1px solid #303447",
          borderRadius: 14,
          boxSizing: "border-box",
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.65)",
        }}
      >
        {closeTarget && (
          <div style={{ display: "grid", gap: 16 }}>
            <h2
              id="close-quiz-title"
              style={{
                margin: 0,
                fontSize: 22,
                color: "#f5b82e",
              }}
            >
              Close Trivia Quiz?
            </h2>

            <strong style={{ overflowWrap: "anywhere" }}>
              {closeTarget.title}
            </strong>

            <p
              id="close-quiz-description"
              style={{ margin: 0, color: "#a5acc1" }}
            >
              Closing this quiz will prevent fans from
              submitting further answers.
            </p>

            <div
              style={{
                background: "#10121b",
                borderRadius: 10,
                padding: 14,
                display: "grid",
                gap: 10,
                color: "#7ccf72",
                fontSize: 14,
              }}
            >
              <div>Existing questions will be preserved.</div>
              <div>Participation history will be retained.</div>
              <div>Earned Fan Points will remain unchanged.</div>
            </div>

            <p style={{ color: "#ff7777", fontSize: 13 }}>
              This action cannot be reversed through the
              Close Quiz control.
            </p>

            {closeError && (
              <p role="alert" style={{ color: "#ff7777" }}>
                {closeError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                autoFocus
                style={secondaryButton}
                disabled={closingId !== null}
                onClick={cancelClose}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: "#b91c1c",
                  color: "#ffffff",
                }}
                disabled={closingId !== null}
                onClick={() => void confirmClose()}
              >
                {closingId !== null
                  ? "Closing Quiz..."
                  : "Close Quiz"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={publishDialogRef}
        aria-labelledby="publish-quiz-title"
        aria-describedby="publish-quiz-description"
        onCancel={(event) => {
          event.preventDefault();
          cancelPublish();
        }}
        style={{
          width: "min(480px, calc(100% - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "auto",
          padding: 24,
          background: "#141722",
          color: "#f5f6fa",
          border: "1px solid #303447",
          borderRadius: 14,
          boxSizing: "border-box",
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.65)",
        }}
      >
        {publishTarget && (
          <div style={{ display: "grid", gap: 16 }}>
            <h2
              id="publish-quiz-title"
              style={{
                margin: 0,
                fontSize: 22,
                color: "#7ccf72",
              }}
            >
              Publish Trivia Quiz?
            </h2>

            <strong style={{ overflowWrap: "anywhere" }}>
              {publishTarget.title}
            </strong>

            <p
              id="publish-quiz-description"
              style={{ margin: 0, color: "#a5acc1" }}
            >
              This quiz will become available to fans
              according to its configured schedule.
            </p>

            <div
              style={{
                background: "#10121b",
                borderRadius: 10,
                padding: 14,
                display: "grid",
                gap: 10,
                fontSize: 14,
              }}
            >
              <div>
                Questions: {publishTarget.questionCount}
              </div>

              <div
                style={{
                  color: hasValidQuizDuration(publishTarget)
                    ? "#7ccf72"
                    : "#ff7777",
                  fontWeight: 700,
                }}
              >
                Total quiz time:{" "}
                {formatTriviaDuration(
                  publishTarget.durationSeconds
                )}
              </div>

              {!hasValidQuizDuration(publishTarget) && (
                <small
                  role="alert"
                  style={{ color: "#ff7777" }}
                >
                  This quiz cannot be published until
                  a valid countdown is configured.
                  Cancel and use Edit Quiz.
                </small>
              )}

              <div>
                Starts: {formatDate(publishTarget.startsAt)}
              </div>

              <div>
                Deadline: {formatDate(publishTarget.endsAt)}
              </div>

              <div>
                Maximum Fan Points:{" "}
                {publishTarget.questions.reduce(
                  (total, question) =>
                    total + question.pointsReward,
                  0
                ).toLocaleString()}
              </div>

              <small style={{ color: "#a5acc1" }}>
                Schedule times are displayed in WAT.
              </small>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                color: "#7ccf72",
                fontSize: 14,
              }}
            >
              <div>
                All associated questions will be activated.
              </div>

              <div>
                The existing schedule will be retained.
              </div>

              <div>
                One continuous countdown will apply
                to all questions in the quiz.
              </div>

              <div>
                Registered fans can earn Fan Points
                when the quiz becomes available.
              </div>
            </div>

            {publishError && (
              <p role="alert" style={{ color: "#ff7777" }}>
                {publishError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                autoFocus
                style={secondaryButton}
                disabled={publishingId !== null}
                onClick={cancelPublish}
              >
                Cancel
              </button>

              <button
                type="button"
                style={{
                  ...buttonStyle,
                  background: "#7ccf72",
                  color: "#171717",
                }}
                disabled={
                  publishingId !== null ||
                  !hasValidQuizDuration(publishTarget)
                }
                onClick={() => void confirmPublish()}
              >
                {publishingId !== null
                  ? "Publishing Quiz..."
                  : "Publish Quiz"}
              </button>
            </div>
          </div>
        )}
      </dialog>

      <dialog
        ref={scheduleDialogRef}
        aria-labelledby="schedule-quiz-title"
        aria-describedby="schedule-quiz-description"
        onCancel={(event) => {
          event.preventDefault();
          cancelSchedule();
        }}
        style={{
          width: "min(480px, calc(100% - 32px))",
          maxHeight: "90vh",
          overflowY: "auto",
          margin: "auto",
          padding: 24,
          background: "#141722",
          color: "#f5f6fa",
          border: "1px solid #303447",
          borderRadius: 14,
          boxSizing: "border-box",
          boxShadow: "0 0 0 100vmax rgba(0,0,0,0.65)",
        }}
      >
        {scheduleTarget && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void confirmSchedule();
            }}
            style={{ display: "grid", gap: 16 }}
          >
            <h2
              id="schedule-quiz-title"
              style={{
                margin: 0,
                fontSize: 22,
                color: "#f5b82e",
              }}
            >
              Edit Quiz Schedule
            </h2>

            <strong style={{ overflowWrap: "anywhere" }}>
              {scheduleTarget.title}
            </strong>

            <p
              id="schedule-quiz-description"
              style={{ margin: 0, color: "#a5acc1" }}
            >
              Update the start date and deadline
              without publishing this draft quiz.
            </p>

            <label style={{ display: "grid", gap: 8 }}>
              Start Date and Time *
              <input
                type="datetime-local"
                step="0.001"
                required
                autoFocus
                disabled={scheduleSaving}
                value={scheduleStart}
                onChange={(event) =>
                  setScheduleStart(event.target.value)
                }
                style={{
                  ...inputStyle,
                  width: "100%",
                  colorScheme: "dark",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              Deadline *
              <input
                type="datetime-local"
                step="0.001"
                required
                disabled={scheduleSaving}
                value={scheduleEnd}
                onChange={(event) =>
                  setScheduleEnd(event.target.value)
                }
                style={{
                  ...inputStyle,
                  width: "100%",
                  colorScheme: "dark",
                }}
              />
            </label>

            <small style={{ color: "#a5acc1" }}>
              These fields use your device's local timezone.
              Dashboard dates are displayed in WAT.
            </small>

            <div
              style={{
                background: "#10121b",
                borderRadius: 10,
                padding: 14,
                display: "grid",
                gap: 10,
                color: "#7ccf72",
                fontSize: 14,
              }}
            >
              <div>All existing questions will be retained.</div>
              <div>Images and Fan Points remain unchanged.</div>
              <div>The quiz will remain in draft status.</div>
            </div>

            {scheduleError && (
              <p role="alert" style={{ color: "#ff7777" }}>
                {scheduleError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                style={secondaryButton}
                disabled={scheduleSaving}
                onClick={cancelSchedule}
              >
                Cancel
              </button>

              <button
                type="submit"
                style={buttonStyle}
                disabled={scheduleSaving}
              >
                {scheduleSaving
                  ? "Saving Schedule..."
                  : "Save Schedule"}
              </button>
            </div>
          </form>
        )}
      </dialog>

      <small style={{ color: "#a5acc1" }}>
        All displayed schedule times are in West Africa Time
        (Africa/Lagos).
      </small>
    </section>
  );
}
