
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "SportyFanz",
  description: "Every Sport. Every Fan. Every Moment.",
  icons: {
    icon: "/browserlogo.svg",
    shortcut: "/browserlogo.svg",
    apple: "/browserlogo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
