"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AdminEntryPage() {
  useEffect(() => {
    window.location.replace("/sf-vault-k8m42x/login/");
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <h1>SportyFanz Administration</h1>
        <p>Redirecting to administrator login...</p>
        <Link href="/sf-vault-k8m42x/login/">
          Continue to Admin Login
        </Link>
      </div>
    </main>
  );
}
