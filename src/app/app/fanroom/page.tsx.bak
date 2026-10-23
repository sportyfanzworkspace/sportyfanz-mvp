"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Gift,
  MoreHorizontal,
  Users,
} from "lucide-react";

const fanMessages = [
  {
    user: "EmmyGunner",
    text: "Saka is on fire today! 🔥",
    time: "7:12 PM",
    avatar: "E",
  },
  {
    user: "BlueForever",
    text: "Chelsea will equalise soon.",
    time: "7:14 PM",
    avatar: "B",
  },
  {
    user: "KennyFC",
    text: "That goal was beautiful!",
    time: "7:16 PM",
    avatar: "K",
  },
  {
    user: "FootballQueen",
    text: "Who do you think will score next?",
    time: "7:18 PM",
    avatar: "F",
  },
  {
    user: "MikelFan",
    text: "Arsenal all the way! ❤️",
    time: "7:20 PM",
    avatar: "M",
  },
];

export default function FanHubPage() {
  const [message, setMessage] = useState("");
  const [roomTab, setRoomTab] = useState("Chat");

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <span>COMMUNITY</span>

          <h1>Fan Room</h1>

          <p>
            Your space to react, discuss and connect
            with fellow fans.
          </p>
        </div>
      </div>

      <div className="fan-room-layout">

        <div className="fan-chat-card">

          <div className="fan-room-header">

            <div className="room-title">

              <div className="room-team-icons">
                <span className="arsenal">A</span>
                <span className="chelsea">C</span>
              </div>

              <div>
                <strong>Arsenal vs Chelsea</strong>
                <span>
                  12.4K Fans • Live Discussion
                </span>
              </div>

            </div>

            <div className="room-actions">
              <button>
                <Bell size={17} />
              </button>

              <button>
                <Users size={17} />
              </button>

              <button>
                <MoreHorizontal size={17} />
              </button>
            </div>

          </div>

          <div className="room-tabs">

            {[
              "Chat",
              "Polls",
              "Challenges",
            ].map((tab) => (

              <button
                key={tab}
                className={
                  roomTab === tab
                    ? "active"
                    : ""
                }
                onClick={() => setRoomTab(tab)}
              >
                {tab}
              </button>

            ))}

          </div>

          <div className="chat-body">

            {fanMessages.map((msg) => (

              <div
                className="chat-message"
                key={msg.user}
              >

                <div className="sf-avatar">
                  {msg.avatar}
                </div>

                <div className="chat-message-content">

                  <div>
                    <strong>{msg.user}</strong>
                    <span>{msg.time}</span>
                  </div>

                  <p>{msg.text}</p>

                </div>

              </div>

            ))}

            <div className="chat-poll">

              <div className="poll-heading">
                <strong>
                  Who will score the next goal?
                </strong>

                <span>
                  65% voted
                </span>
              </div>

              <div className="poll-option">
                <span>Arsenal</span>
                <strong>65%</strong>
              </div>

              <div className="poll-progress">
                <span style={{ width: "65%" }} />
              </div>

              <div className="poll-option">
                <span>Chelsea</span>
                <strong>25%</strong>
              </div>

              <div className="poll-progress">
                <span style={{ width: "25%" }} />
              </div>

              <div className="poll-option">
                <span>More Goals</span>
                <strong>10%</strong>
              </div>

              <div className="poll-progress">
                <span style={{ width: "10%" }} />
              </div>

              <button>
                Vote
              </button>

            </div>

          </div>

          <div className="chat-input">

            <input
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder="Type a message..."
            />

            <button>
              <ArrowRight size={17} />
            </button>

          </div>

        </div>

        <aside>

          <div className="white-panel">

            <div className="panel-title">
              <h3>Top Fans</h3>
            </div>

            {[
              "KingTee",
              "Esther",
              "BlueRanger",
              "FootballQueen",
            ].map((name, index) => (

              <div className="top-fan" key={name}>

                <div className="rank">
                  {index + 1}
                </div>

                <div className="sf-avatar small">
                  {name[0]}
                </div>

                <div className="top-fan-info">
                  <strong>{name}</strong>

                  <span>
                    {1300 - index * 130} pts
                  </span>
                </div>

              </div>

            ))}

          </div>

          <div className="room-reward-card">

            <Gift size={28} />

            <span>Fan Room Reward</span>

            <strong>Earn +50 pts</strong>

            <p>
              Participate in this room to increase
              your Fan Score.
            </p>

          </div>

        </aside>

      </div>
    </div>
  );
}