"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Gift,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

type SocialTask = {
  id: string;
  taskKey: string;
  name: string;
  handle: string;
  url: string;
  description: string;
  points: number;
  completed: boolean;
};

function SocialBrandIcon({ platform }: { platform: string }) {
  switch (platform) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.1H7.6V13h2.7v8z"
          />
        </svg>
      );

    case "x":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.5l7.3-8.4L1.8 2h6.5l4.5 6.8zM17.8 19.8h1.7L7.2 4.1H5.4z"
          />
        </svg>
      );

    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="17.5" cy="6.8" r="1.2" fill="currentColor" />
        </svg>
      );

    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#25F4EE"
            d="M12.5 2h3.4c.2 2.2 1.5 4.1 3.7 4.8v3.5a9 9 0 0 1-3.7-1.2v6.5a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v3.5a3 3 0 1 0 1.8 2.8z"
          />
          <path
            fill="#FE2C55"
            d="M10.7 9.2v3.6a3 3 0 1 0 1.8 2.8V2h3.4c.2 2.2 1.5 4.1 3.7 4.8v3.5a9 9 0 0 1-3.7-1.2v6.5a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1z"
            opacity=".85"
          />
          <path
            fill="#fff"
            d="M12.5 2h2.1c.2 2.2 1.5 4.1 3.7 4.8v2.2a8.7 8.7 0 0 1-3.7-1.5v7.1a6.4 6.4 0 1 1-6.4-6.4c.4 0 .8 0 1.2.1v2.3a4.1 4.1 0 0 0-1.2-.2 4.1 4.1 0 1 0 4.1 4.1z"
          />
        </svg>
      );

    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#FF0033"
            d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"
          />
          <path fill="#fff" d="m9.6 15.6 6.2-3.6-6.2-3.6z" />
        </svg>
      );

    default:
      return null;
  }
}

export default function SocialFollowEarn() {
  const [tasks, setTasks] = useState<SocialTask[]>([]);
  const [progressionPoints, setProgressionPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      try {
        const response = await fetch("/api/progression/social", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load social tasks.");
        }

        if (active) {
          setTasks(data.tasks ?? []);
          setProgressionPoints(data.progressionPoints ?? 0);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load social tasks."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTasks();

    return () => {
      active = false;
    };
  }, []);

  async function claimTask(task: SocialTask) {
    setClaiming(task.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/progression/social", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: task.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to claim points.");
      }

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? { ...item, completed: true }
            : item
        )
      );

      setProgressionPoints(data.progressionPoints ?? progressionPoints);

      setMessage(
        data.alreadyCompleted
          ? `${task.name} has already been claimed.`
          : `Success! You earned ${data.pointsAwarded} progression points from ${task.name}.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to claim points."
      );
    } finally {
      setClaiming(null);
    }
  }

  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <section className="white-panel social-earn-panel">
      <div className="social-earn-heading">
        <div>
          <span className="social-earn-eyebrow">
            FOLLOW • CONNECT • EARN
          </span>
          <h3>Follow SportyFanz & Earn</h3>
          <p>
            Connect with SportyFanz on social media and earn
            progression points for each platform.
          </p>
        </div>

        <div className="social-earn-total">
          <Gift size={19} />
          <strong>+10</strong>
          <span>POINTS EACH</span>
        </div>
      </div>

      <div className="social-earn-progress">
        <div>
          <span>Tasks completed</span>
          <strong>
            {completedCount} / {tasks.length}
          </strong>
        </div>

        <div className="social-earn-progress-track">
          <span
            style={{
              width: `${
                tasks.length
                  ? (completedCount / tasks.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>

        <div className="social-earn-balance">
          <span>Your progression points</span>
          <strong>{progressionPoints.toLocaleString()}</strong>
        </div>
      </div>

      {loading ? (
        <div className="social-earn-loading">
          <LoaderCircle size={18} className="social-spin" />
          Loading social tasks...
        </div>
      ) : error && tasks.length === 0 ? (
        <p className="social-earn-error">{error}</p>
      ) : (
        <div className="social-task-grid">
          {tasks.map((task) => (
            <div className="social-task-card" key={task.id}>
              <div className="social-task-top">
                <div className={`social-platform-icon social-${task.id}`}>
                  <SocialBrandIcon platform={task.id} />
                </div>

                <div className="social-task-identity">
                  <strong>{task.name}</strong>
                  <span>{task.handle}</span>
                </div>

                <span className="social-task-points">
                  +{task.points}
                </span>
              </div>

              <p>{task.description}</p>

              <div className="social-task-actions">
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-visit-button"
                >
                  Visit account
                  <ExternalLink size={13} />
                </a>

                {task.completed ? (
                  <span className="social-completed">
                    <CheckCircle2 size={15} />
                    Completed
                  </span>
                ) : (
                  <button
                    type="button"
                    className="social-claim-button"
                    disabled={claiming !== null}
                    onClick={() => claimTask(task)}
                  >
                    {claiming === task.id ? (
                      <>
                        <LoaderCircle
                          size={14}
                          className="social-spin"
                        />
                        Claiming...
                      </>
                    ) : (
                      "I followed — claim"
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className="social-earn-success">
          <CheckCircle2 size={15} />
          {message}
        </p>
      )}

      {error && tasks.length > 0 && (
        <p className="social-earn-error">{error}</p>
      )}
    </section>
  );
}
