"use client";

import {
  CalendarDays,
  ChevronDown,
} from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="header-actions">
        <button className="secondary-button">
          <CalendarDays size={15} />
          Today
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}