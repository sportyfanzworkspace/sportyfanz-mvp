"use client";

import { useEffect, useState } from "react";
import { Timer, Clock, CheckCircle2 } from "lucide-react";

import {
  formatTriviaCountdown,
  getTriviaCountdownSeconds,
  type TriviaCountdownClock,
  type TriviaSessionStatus,
} from "@/lib/trivia-countdown";

import {
  formatTriviaDuration,
} from "@/lib/trivia-duration";

type Props = {
  status: TriviaSessionStatus | null;
  durationSeconds: number | null;
  clock: TriviaCountdownClock | null;
};

export default function TriviaCountdown({
  status,
  durationSeconds,
  clock,
}: Props) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    function update() {
      setNow(performance.now());
    }

    update();

    if (status !== "ACTIVE" || !clock) {
      return;
    }

    const interval = window.setInterval(
      update,
      200
    );

    document.addEventListener(
      "visibilitychange",
      update
    );

    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        update
      );

      window.removeEventListener(
        "focus",
        update
      );
    };
  }, [status, clock]);

  if (
    durationSeconds === null &&
    status !== "ACTIVE"
  ) {
    return null;
  }

  if (
    status === "ACTIVE" &&
    (!clock || now < clock.capturedAt)
  ) {
    return (
      <div className="sf-trivia-countdown">
        Synchronising countdown...
      </div>
    );
  }

  const seconds =
    status === "EXPIRED" ||
    status === "CLOSED" ||
    status === "COMPLETED"
      ? 0
      : getTriviaCountdownSeconds(
          clock,
          now
        );

  const expired =
    status === "EXPIRED" ||
    (status === "ACTIVE" && seconds === 0);

  const completed = status === "COMPLETED";
  const closed = status === "CLOSED";

  const running =
    status === "ACTIVE" && !expired;

  const urgent = running && seconds <= 10;

  const progress = running
    ? Math.max(
        0,
        Math.min(
          100,
          seconds /
            Math.max(1, durationSeconds ?? 1) *
            100
        )
      )
    : 0;

  const className = [
    "sf-trivia-countdown",
    expired || urgent
      ? "sf-trivia-countdown-danger"
      : "",
    completed
      ? "sf-trivia-countdown-completed"
      : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <div className="sf-trivia-countdown-header">
        {completed ? (
          <CheckCircle2 size={22} />
        ) : running || expired ? (
          <Timer size={22} />
        ) : (
          <Clock size={22} />
        )}

        <div className="sf-trivia-countdown-copy">
          <span>
            {completed
              ? "Trivia completed"
              : expired
                ? "Time's up!"
                : closed
                  ? "Trivia closed"
                  : running
                    ? "Time remaining"
                    : "Time limit"}
          </span>

          <strong
            role={running ? "timer" : undefined}
            aria-live="off"
          >
            {running || expired
              ? formatTriviaCountdown(seconds)
              : completed
                ? "Completed"
                : closed
                  ? "Closed"
                  : formatTriviaDuration(
                      durationSeconds
                    )}
          </strong>
        </div>
      </div>

      {running && (
        <div
          className="sf-trivia-countdown-track"
          aria-hidden="true"
        >
          <div
            className="sf-trivia-countdown-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {expired && (
        <p role="status">
          Your countdown has expired.
          Previously earned Fan Points are retained.
        </p>
      )}

      {closed && (
        <p role="status">
          This Trivia activity is no longer
          accepting answers.
        </p>
      )}

      {urgent && (
        <p>Hurry! Your time is almost up.</p>
      )}
    </div>
  );
}
