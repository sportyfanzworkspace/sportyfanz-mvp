"use client";

import { useEffect, useState } from "react";
import HomePage from "./home-page-client";

export default function Page() {
  const [initialWelcome, setInitialWelcome] = useState(false);

  useEffect(() => {
    setInitialWelcome(
      new URLSearchParams(window.location.search).get("welcome") === "1"
    );
  }, []);

  return (
    <HomePage
      initialNews={[]}
      initialWelcome={initialWelcome}
    />
  );
}
