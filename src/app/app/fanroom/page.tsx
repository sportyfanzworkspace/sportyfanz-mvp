
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Gift,
  MoreHorizontal,
  Users,
} from "lucide-react";

type FanMessage = {
  id: number;
  message: string;
  createdAt: string;
  userId: number;
  username: string;
  avatarUrl: string | null;
  isEdited: boolean;
};

type FanRoom = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  status: string;
  memberCount: number;
  isJoined: boolean;
  messages: FanMessage[];
};

type PollOption = {
  id: number;
  label: string;
  votes: number;
  percentage: number;
};

type FanPoll = {
  id: number;
  question: string;
  description: string | null;
  pointsReward: number;
  startsAt: string | null;
  endsAt: string | null;
  isOpen: boolean;
  totalVotes: number;
  myVote: {
    optionId: number;
  } | null;
  options: PollOption[];
};

type PollsResponse = {
  balance: number;
  totalPoints: number;
  polls: FanPoll[];
};

export default function FanHubPage() {
  const [rooms, setRooms] = useState<FanRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [roomTab, setRoomTab] = useState("Chat");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fanRoomsJoined, setFanRoomsJoined] = useState(0);
  const [pollsData, setPollsData] = useState<PollsResponse | null>(null);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [votingPollId, setVotingPollId] = useState<number | null>(null);
  const [pollMessage, setPollMessage] = useState("");
  const [pollError, setPollError] = useState("");

  const formatPoints = (points: number) =>
    new Intl.NumberFormat("en-US").format(points);

   const loadRooms = useCallback(async () => {
     try {
       setError("");

      const response = await fetch("/api/fanrooms", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load Fan Rooms.");
      }

      const loadedRooms: FanRoom[] = data.rooms ?? [];

      setRooms(loadedRooms);
      setFanRoomsJoined(data.profile?.fanRoomsJoined ?? 0);

      setSelectedRoomId((currentId) => {
        if (currentId !== null && loadedRooms.some((room) => room.id === currentId)) {
          return currentId;
        }
        return loadedRooms[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Fan Rooms.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  
const loadPolls = useCallback(async () => {
  try {
    setPollsLoading(true);
    setPollError("");

    const response = await fetch("/api/polls", {
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to load polls.");
    }

    setPollsData(result as PollsResponse);
  } catch (err) {
    setPollError(
      err instanceof Error ? err.message : "Failed to load polls."
    );
  } finally {
    setPollsLoading(false);
  }
}, []);

useEffect(() => {
  if (roomTab !== "Polls") return;

  void loadPolls();
}, [roomTab, loadPolls]);

const handlePollVote = async (pollId: number, optionId: number) => {
  if (votingPollId !== null) return;

  setVotingPollId(pollId);
  setPollError("");
  setPollMessage("");

  try {
    const response = await fetch("/api/polls/vote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pollId, optionId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Unable to submit your vote.");
    }

    setPollMessage(
      `${result.message || "Your vote has been recorded."} You earned ${formatPoints(
        result.pointsEarned ?? 0
      )} Sporty Points.`
    );

    await loadPolls();
  } catch (err) {
    setPollError(
      err instanceof Error ? err.message : "Unable to submit your vote."
    );
  } finally {
    setVotingPollId(null);
  }
};

  const selectedRoom =
    rooms.find((room) => room.id === selectedRoomId) ?? null;

  const sendMessage = async () => {
    const text = message.trim();

    if (!selectedRoom || !text || sending) return;

    if (!selectedRoom.isJoined) {
      setError("Join this Fan Room before sending messages.");
      return;
    }

    setSending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/fanrooms/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          message: text,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send your message.");
      }

      const newMessage: FanMessage = data.message;

      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.id === selectedRoom.id
            ? { ...room, messages: [...room.messages, newMessage] }
            : room
        )
      );

      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send your message.");
    } finally {
      setSending(false);
    }
  };

  const toggleMembership = async () => {
    if (!selectedRoom || joining) return;

    setJoining(true);
    setError("");
    setNotice("");

    const action = selectedRoom.isJoined ? "leave" : "join";

    try {
      const response = await fetch("/api/fanrooms/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: selectedRoom.id,
          action,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} Fan Room.`);
      }

      setRooms((currentRooms) =>
        currentRooms.map((room) =>
          room.id === selectedRoom.id
            ? {
                ...room,
                isJoined: action === "join",
                memberCount: Math.max(
                  0,
                  room.memberCount + (action === "join" ? 1 : -1)
                ),
              }
            : room
        )
      );

      setFanRoomsJoined((count) =>
        Math.max(0, count + (action === "join" ? 1 : -1))
      );

      setNotice(
        action === "join"
          ? `You joined ${selectedRoom.name}.`
          : `You left ${selectedRoom.name}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} Fan Room.`);
    } finally {
      setJoining(false);
    }
  };

  const formatTime = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span>COMMUNITY</span>
          <h1>Fan Room</h1>
          <p>Your space to react, discuss and connect with fellow fans.</p>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: 16 }}>
          {error}
          <button
            type="button"
            onClick={() => setError("")}
            style={{ marginLeft: 12 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <p role="status" style={{ marginBottom: 16 }}>
          {notice}
        </p>
      )}

      {loading ? (
        <div className="white-panel" role="status">
          Loading Fan Rooms...
        </div>
      ) : rooms.length === 0 ? (
        <div className="white-panel">
          <h3>No active Fan Rooms yet</h3>
          <p>Check back when a room becomes available.</p>
          <button type="button" onClick={() => void loadRooms()}>
            Refresh
          </button>
        </div>
      ) : (
        <div className="fan-room-layout">
          <div className="fan-chat-card">
            <div className="fan-room-header">
              <div className="room-title">
                <div className="room-team-icons">
                  <span className="arsenal">
                    {(selectedRoom?.name ?? "F").charAt(0).toUpperCase()}
                  </span>
                  <span className="chelsea">
                    <Users size={16} />
                  </span>
                </div>

                <div>
                  <strong>{selectedRoom?.name}</strong>
                  <span>
                    {selectedRoom?.memberCount ?? 0} Fans • Fan Discussion
                  </span>
                </div>
              </div>

              <div className="room-actions">
                <button
                  type="button"
                  title="Refresh rooms and messages"
                  aria-label="Refresh rooms and messages"
                  onClick={() => void loadRooms()}
                >
                  <Bell size={17} />
                </button>

                <button
                  type="button"
                  title={selectedRoom?.isJoined ? "Leave room" : "Join room"}
                  aria-label={selectedRoom?.isJoined ? "Leave room" : "Join room"}
                  onClick={() => void toggleMembership()}
                  disabled={joining}
                >
                  <Users size={17} />
                </button>

                <button
                  type="button"
                  title="Room details"
                  aria-label="Room details"
                  onClick={() =>
                    setNotice(
                      selectedRoom?.description || "No room description available."
                    )
                  }
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
            </div>

            <div className="room-tabs">
              {["Chat", "Polls", "Challenges"].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  className={roomTab === tab ? "active" : ""}
                  onClick={() => setRoomTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {roomTab === "Chat" ? (
              <>
                <div className="chat-body">
                  {selectedRoom?.messages.length ? (
                    selectedRoom.messages.map((msg) => (
                      <div className="chat-message" key={msg.id}>
                        <div className="sf-avatar">
                          {msg.avatarUrl ? (
                            <img
                              src={msg.avatarUrl}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            msg.username.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="chat-message-content">
                          <div>
                            <strong>{msg.username}</strong>
                            <span>
                              {formatTime(msg.createdAt)}
                              {msg.isEdited ? " · edited" : ""}
                            </span>
                          </div>
                          <p>{msg.message}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ padding: 20 }}>
                      No messages yet. Be the first to start the conversation!
                    </p>
                  )}
                </div>

                {!selectedRoom?.isJoined && (
                  <p style={{ padding: "0 16px" }}>
                    Join this room to participate in the conversation.
                  </p>
                )}

                <form
                  className="chat-input"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                >
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={
                      selectedRoom?.isJoined
                        ? "Type a message..."
                        : "Join this room to chat..."
                    }
                    maxLength={1000}
                    disabled={!selectedRoom?.isJoined || sending}
                  />

                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={
                      !selectedRoom?.isJoined ||
                      !message.trim() ||
                      sending
                    }
                  >
                    <ArrowRight size={17} />
                  </button>
                </form>
              </>
            ) : (
              <div className="chat-body">
                 
{roomTab === "Polls" ? (
  <div style={{ padding: 16 }}>
    {pollError && (
      <p role="alert" style={{ marginBottom: 12 }}>
        {pollError}
      </p>
    )}

    {pollMessage && (
      <p role="status" style={{ marginBottom: 12 }}>
        {pollMessage}
      </p>
    )}

    {pollsLoading && !pollsData ? (
      <p role="status">Loading fan polls...</p>
    ) : !pollsData || pollsData.polls.length === 0 ? (
      <div>
        <h3>No active polls yet</h3>
        <p>
          Platform-wide polls will appear here when they are available.
        </p>
        <button type="button" onClick={() => void loadPolls()}>
          Refresh polls
        </button>
      </div>
    ) : (
      <>
        {pollsData.polls.map((poll) => {
          const hasVoted = poll.myVote !== null;
          const isVoting = votingPollId === poll.id;

          return (
            <div
              key={poll.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                }}
              >
                FAN POLL
              </span>

              <h3 style={{ marginTop: 8 }}>{poll.question}</h3>

              {poll.description && <p>{poll.description}</p>}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  margin: "12px 0 16px",
                }}
              >
                <strong>+{formatPoints(poll.pointsReward)} pts</strong>
                <span>
                  {formatPoints(poll.totalVotes)}{" "}
                  {poll.totalVotes === 1 ? "vote" : "votes"}
                </span>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {poll.options.map((option) => {
                  const selected = poll.myVote?.optionId === option.id;

                  return (
                    <div key={option.id}>
                      <button
                        type="button"
                        disabled={hasVoted || !poll.isOpen || isVoting}
                        onClick={() => void handlePollVote(poll.id, option.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: 10,
                          border: selected
                            ? "2px solid #16a34a"
                            : "1px solid #e5e7eb",
                          background: selected
                            ? "rgba(22,163,74,0.08)"
                            : "transparent",
                          color: "inherit",
                          textAlign: "left",
                          font: "inherit",
                          cursor:
                            hasVoted || !poll.isOpen ? "default" : "pointer",
                        }}
                      >
                        <span>{option.label}</span>
                        {hasVoted && <strong>{option.percentage}%</strong>}
                        {isVoting && <span>Submitting...</span>}
                      </button>

                      {hasVoted && (
                        <div
                          style={{
                            height: 6,
                            borderRadius: 6,
                            background: "#e5e7eb",
                            overflow: "hidden",
                            marginTop: 5,
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${option.percentage}%`,
                              background: "#16a34a",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <p style={{ marginTop: 14, marginBottom: 0 }}>
                {hasVoted
                  ? "Your vote has been recorded."
                  : poll.isOpen
                    ? "Select an option to cast your vote."
                    : "This poll is not currently open for voting."}
              </p>

              {poll.endsAt && (
                <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 0 }}>
                  Ends:{" "}
                  {new Date(poll.endsAt).toLocaleString("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
           );
          })}

           <button
             type="button"
             onClick={() => void loadPolls()}
             disabled={pollsLoading}
            >
               {pollsLoading ? "Refreshing..." : "Refresh polls"}
             </button>
               </>
               )}
              </div>
               ) : (
                 <p>Fan Room challenges will appear here when connected.</p>
               )}

              </div>
            )}
          </div>

          <aside>
            <div className="white-panel">
              <div className="panel-title">
                <h3>Available Fan Rooms</h3>
              </div>

              <p style={{ padding: "0 16px" }}>
                You have joined {fanRoomsJoined} room
                {fanRoomsJoined === 1 ? "" : "s"}.
              </p>

              {rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setRoomTab("Chat");
                    setError("");
                    setNotice("");
                  }}
                  aria-pressed={selectedRoomId === room.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "12px 16px",
                    textAlign: "left",
                    border: 0,
                    cursor: "pointer",
                    background:
                      selectedRoomId === room.id ? "#fff6d8" : "transparent",
                  }}
                >
                  <div className="sf-avatar small">
                    {room.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: "block" }}>{room.name}</strong>
                    <span>
                      {room.memberCount} fans
                      {room.isJoined ? " · Joined" : ""}
                    </span>
                  </div>
                </button>
              ))}

              {selectedRoom && (
                <div style={{ padding: 16 }}>
                  <button
                    type="button"
                    onClick={() => void toggleMembership()}
                    disabled={joining}
                  >
                    {joining
                      ? "Please wait..."
                      : selectedRoom.isJoined
                        ? "Leave Room"
                        : "Join Room"}
                  </button>
                </div>
              )}
            </div>

            <div className="room-reward-card">
              <Gift size={28} />
              <span>Fan Room Reward</span>
              <strong>Earn +50 pts</strong>
              <p>
                Participate in this room to increase your Fan Score.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
