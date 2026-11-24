import type { ReactNode } from "react";

export function Icon({
  name,
  size = 20,
  stroke = 1.8
}: {
  name: string;
  size?: number;
  stroke?: number;
}) {

  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };

  const paths: Record<string, ReactNode> = {

    home: (
      <>
        <path d="M3 10.8 12 3l9 7.8" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </>
    ),

    search: (
      <>
        <circle
          cx="10.8"
          cy="10.8"
          r="6.8"
        />
        <path d="m16 16 5 5" />
      </>
    ),

    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),

    match: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />
        <path d="m8 4 2 4-3 3 4 2 1 6m4-15-2 4 3 3-4 2-1 6" />
      </>
    ),

    users: (
      <>
        <circle
          cx="9"
          cy="8"
          r="3"
        />

        <circle
          cx="17"
          cy="9"
          r="2.5"
        />

        <path d="M3 20c.7-3.4 3-5 6-5s5.3 1.6 6 5M15 15c3.1-.2 5 1.5 5.5 4" />
      </>
    ),

    compass: (
      <>
        <circle
          cx="12"
          cy="12"
          r="9"
        />

        <path d="m15 9-2 5-5 2 2-5 5-2Z" />
      </>
    ),

    community: (
      <>
        <path d="M4 5h16v11H8l-4 4V5Z" />
        <path d="M8 9h8M8 12h6" />
      </>
    ),

    trophy: (
      <>
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
        <path d="M9 17h6M8 21h8M12 13v4" />
        <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
      </>
    ),

    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),

    settings: (
      <>
        <circle
          cx="12"
          cy="12"
          r="3"
        />

        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.9 1.9-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.7V20a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.9-1.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H6v-2.7h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.9-1.9.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5h2.7v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.9 1.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.7h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),

    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),

    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),

    chart: (
      <>
        <path d="M4 19V5M4 19h16" />
        <path d="m7 15 3-4 3 2 4-6" />
      </>
    )
  };

  return (
    <svg {...props}>
      {paths[name] ?? paths.home}
    </svg>
  );
}