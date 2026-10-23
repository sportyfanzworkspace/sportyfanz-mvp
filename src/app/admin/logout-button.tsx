
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to log out. Please try again.");
      }

      router.replace("/admin/login");
      router.refresh();
    } catch {
      setError("Logout failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loading}
        style={{
          background: "#303447",
          color: "#ffffff",
          border: "1px solid #454b60",
          borderRadius: 8,
          padding: "10px 16px",
          fontWeight: 600,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Signing out..." : "Logout"}
      </button>

      {error && (
        <p role="alert" style={{ color: "#ff7777", fontSize: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
