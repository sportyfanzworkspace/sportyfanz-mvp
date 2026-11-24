"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const STORAGE_KEY = "sportyfanz-theme";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(STORAGE_KEY);

      const initialTheme: Theme =
        savedTheme === "dark" ? "dark" : "light";

      setTheme(initialTheme);

      document.documentElement.setAttribute(
        "data-theme",
        initialTheme
      );
    } catch {
      document.documentElement.setAttribute(
        "data-theme",
        "light"
      );
    }
  }, []);

  function toggleTheme() {
    const nextTheme: Theme =
      theme === "light" ? "dark" : "light";

    setTheme(nextTheme);

    document.documentElement.setAttribute(
      "data-theme",
      nextTheme
    );

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        nextTheme
      );
    } catch {
      // Theme still works when storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      className="sf-icon-button sf-theme-toggle"
      onClick={toggleTheme}
      aria-label={
        theme === "light"
          ? "Switch to dark mode"
          : "Switch to light mode"
      }
      title={
        theme === "light"
          ? "Dark Mode"
          : "Light Mode"
      }
    >
      {theme === "light" ? (
        <Moon size={18} />
      ) : (
        <Sun size={18} />
      )}
    </button>
  );
}
