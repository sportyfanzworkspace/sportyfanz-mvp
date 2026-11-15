"use client";

import { useState } from "react";
import {
  Bell,
  Gift,
  Radio,
} from "lucide-react";

export default function Notifications() {
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-wrapper">
      <button
        type="button"
        className="sf-icon-button notification-button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notifications"
      >
        <Bell size={18} />

        <span className="notification-dot" />
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-title">
            Notifications
          </div>

          <div className="notification-row">
            <div className="notification-icon">
              <Gift size={15} />
            </div>

            <div>
              <strong>Reward unlocked</strong>
              <p>
                You earned 250 Fan Points.
              </p>
            </div>
          </div>

          <div className="notification-row">
            <div className="notification-icon">
              <Radio size={15} />
            </div>

            <div>
              <strong>Match is live</strong>
              <p>
                Arsenal vs Chelsea is underway.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}